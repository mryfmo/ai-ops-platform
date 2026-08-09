#!/usr/bin/env python3
# 根拠: ADR-0020 / docs/plans/2026-08-final-architecture（取込パックの自己検証ツール。PACK-IMPORT merge-gate 是正）
from __future__ import annotations
from pathlib import Path
import csv
import json
import sys
from urllib.parse import urlparse
import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    'PACK_MANIFEST.yaml','START_HERE.md','DOCUMENT_INDEX.md','APPLY_TO_REPOSITORY.md',
    'BASELINE.md','SOURCE_REGISTER.md',
    '06_implementation/01_master_plan.md','06_implementation/02_wbs.yaml',
    '07_agent_execution/AGENTS_ADDENDUM.md','07_agent_execution/TASK_MANIFEST_TEMPLATE.yaml',
    '07_agent_execution/COMPLETION_EVIDENCE_TEMPLATE.yaml',
    '08_verification/02_acceptance_test_catalog.yaml',
    '05_contracts/control-api.openapi.yaml','05_contracts/events.asyncapi.yaml',
    '06_implementation/08_feature_flags.yaml'
]

def fail(msg: str) -> None:
    print(f'ERROR: {msg}', file=sys.stderr)
    raise SystemExit(1)

def resolve_pointer(doc, ref: str):
    if not ref.startswith('#/'):
        return None
    cur = doc
    for raw in ref[2:].split('/'):
        key = raw.replace('~1','/').replace('~0','~')
        if isinstance(cur, list):
            cur = cur[int(key)]
        elif isinstance(cur, dict) and key in cur:
            cur = cur[key]
        else:
            fail(f'unresolved internal $ref: {ref}')
    return cur

def walk_refs(node, doc):
    if isinstance(node, dict):
        ref = node.get('$ref')
        if isinstance(ref, str) and ref.startswith('#/'):
            resolve_pointer(doc, ref)
        for v in node.values():
            walk_refs(v, doc)
    elif isinstance(node, list):
        for v in node:
            walk_refs(v, doc)

for rel in REQUIRED:
    if not (ROOT / rel).is_file():
        fail(f'missing required file: {rel}')

files = [p for p in ROOT.rglob('*') if p.is_file() and p.name != 'SHA256SUMS']
for p in files:
    if p.stat().st_size == 0:
        fail(f'empty file: {p.relative_to(ROOT)}')

# Parse every JSON/YAML file.
parsed = {}
for p in files:
    try:
        if p.suffix == '.json':
            parsed[p] = json.loads(p.read_text(encoding='utf-8'))
        elif p.suffix in {'.yaml','.yml'}:
            parsed[p] = yaml.safe_load(p.read_text(encoding='utf-8'))
    except Exception as exc:
        fail(f'parse failed: {p.relative_to(ROOT)}: {exc}')

# Check manifest references.
manifest = parsed[ROOT/'PACK_MANIFEST.yaml']
for rel in manifest.get('reading_order', []):
    if not (ROOT/rel).exists():
        fail(f'manifest reading_order missing: {rel}')
if manifest.get('baseline', {}).get('commit') != '49e2e3c0a3a9d30be46b2a3ae0727009d9eec324':
    fail('unexpected baseline commit')

wbs = parsed[ROOT/'06_implementation/02_wbs.yaml']
tasks = wbs.get('tasks', [])
if len(tasks) < 100:
    fail(f'expected comprehensive WBS (>=100 tasks), got {len(tasks)}')
ids = [t['id'] for t in tasks]
if len(ids) != len(set(ids)):
    fail('duplicate WBS task IDs')
idset = set(ids)
valid_writers = {'claude-code-fable5-xhigh','codex-gpt56-sol-high'}
phase_ids = {p['id'] for p in wbs.get('phases', [])}
for t in tasks:
    phase = t['id'].split('-')[0]
    if phase not in phase_ids:
        fail(f"unknown phase in task {t['id']}")
    if t.get('writer') not in valid_writers:
        fail(f"invalid writer for {t['id']}: {t.get('writer')}")
    if t.get('reviewer') == t.get('writer'):
        fail(f"writer and reviewer must differ: {t['id']}")
    for dep in t.get('depends_on', []):
        if dep not in idset:
            fail(f"unknown dependency {dep} in {t['id']}")
    for key in ['allowed_paths','forbidden_paths','deliverables','acceptance','verification','acceptance_gate_ids','requirement_refs','adr_refs']:
        if not t.get(key):
            fail(f"{t['id']} missing {key}")
    if set(t['allowed_paths']) & set(t['forbidden_paths']):
        fail(f"{t['id']} contains identical allowed/forbidden entries")

# Detect dependency cycles.
visiting, visited = set(), set()
byid = {t['id']: t for t in tasks}
def visit(n: str):
    if n in visiting: fail(f'WBS dependency cycle at {n}')
    if n in visited: return
    visiting.add(n)
    for d in byid[n].get('depends_on', []): visit(d)
    visiting.remove(n); visited.add(n)
for n in ids: visit(n)
for phase in phase_ids:
    if not any(t['id'].startswith(phase+'-') for t in tasks):
        fail(f'phase has no tasks: {phase}')

acc = parsed[ROOT/'08_verification/02_acceptance_test_catalog.yaml']
gates = acc.get('gates', [])
gids = [g['id'] for g in gates]
if len(gids) != len(set(gids)):
    fail('duplicate acceptance gate IDs')
if len(gates) < 50:
    fail(f'expected >=50 acceptance gates, got {len(gates)}')
gate_set = set(gids)
for t in tasks:
    unknown = set(t.get('acceptance_gate_ids', [])) - gate_set
    if unknown:
        fail(f"{t['id']} references unknown acceptance gates: {sorted(unknown)}")

flags = parsed[ROOT/'06_implementation/08_feature_flags.yaml']
byflag = {f['name']: f for f in flags['flags']}
for prohibited in ['cloudflare.artifacts.enabled','notion.baseline.enabled','aiops.auto_production_remediation.enabled']:
    f = byflag.get(prohibited)
    if not f or f.get('default') is not False or not f.get('immutable_false'):
        fail(f'{prohibited} must be immutable false')

# Contract version/ref checks.
openapi = parsed[ROOT/'05_contracts/control-api.openapi.yaml']
if not str(openapi.get('openapi','')).startswith('3.1'):
    fail('Control API must use OpenAPI 3.1')
if '/workflows' not in openapi.get('paths', {}):
    fail('Control API missing /workflows')
walk_refs(openapi, openapi)
asyncapi = parsed[ROOT/'05_contracts/events.asyncapi.yaml']
if not asyncapi.get('asyncapi'):
    fail('AsyncAPI version missing')
walk_refs(asyncapi, asyncapi)

# JSON Schema meta validation and internal refs.
for rel in ['05_contracts/domain-schemas.json','05_contracts/policy-input.schema.json','05_contracts/policy-decision.schema.json']:
    doc = parsed[ROOT/rel]
    try:
        Draft202012Validator.check_schema(doc)
    except Exception as exc:
        fail(f'invalid JSON Schema {rel}: {exc}')
    walk_refs(doc, doc)

# CSV integrity.
with (ROOT/'02_requirements/05_traceability_matrix.csv').open(encoding='utf-8-sig', newline='') as f:
    rows = list(csv.reader(f))
if len(rows) < 11 or rows[0] != ['Product Requirement','Functional Requirements','Component','Primary Paths','Acceptance Gates']:
    fail('traceability matrix header/rows invalid')

# Mermaid source sanity.
for p in (ROOT/'11_diagrams').glob('*.mmd'):
    first = p.read_text(encoding='utf-8').lstrip().splitlines()[0]
    if first not in {'flowchart LR','flowchart TB','sequenceDiagram','stateDiagram-v2'}:
        fail(f'unsupported Mermaid header in {p.name}: {first}')

# Source register URLs must be syntactically HTTPS.
for line in (ROOT/'SOURCE_REGISTER.md').read_text(encoding='utf-8').splitlines():
    if 'https://' in line:
        for token in line.replace('|',' ').replace('`',' ').split():
            if token.startswith('https://'):
                url = token.rstrip(').,')
                parsed_url = urlparse(url)
                if parsed_url.scheme != 'https' or not parsed_url.netloc:
                    fail(f'invalid source URL: {url}')

# PACK-IMPORT-003: unquoted list scalars containing ' #' are silently truncated by YAML comments.
_wbs_raw = (ROOT / '06_implementation/02_wbs.yaml').read_text(encoding='utf-8')
_bad = []
for _i, _line in enumerate(_wbs_raw.splitlines(), 1):
    _s = _line.lstrip()
    if _s.startswith('- ') and not _s.startswith(("- '", '- "')) and ' #' in _s:
        _bad.append(f'02_wbs.yaml:{_i}')
if _bad:
    fail('unquoted # would truncate scalars: ' + ', '.join(_bad))

print(f'OK: {len(tasks)} WBS tasks, {len(gates)} acceptance gates, {len(files)} files')
