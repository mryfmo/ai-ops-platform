#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import yaml

root = Path(__file__).resolve().parents[1]
data = yaml.safe_load((root/'06_implementation/02_wbs.yaml').read_text(encoding='utf-8'))
lines = ['# WBS Task Summary', '', f"Total tasks: **{len(data['tasks'])}**", '']
wc = Counter(t['writer'] for t in data['tasks'])
lines += ['## Writer distribution', ''] + [f'- `{k}`: {v}' for k,v in sorted(wc.items())] + ['']
lines += ['## Phase summary', '', '| Phase | Name | Tasks |', '|---|---|---:|']
for p in data['phases']:
    ts=[t for t in data['tasks'] if t['id'].startswith(p['id']+'-')]
    lines.append(f"| {p['id']} | {p['name']} | {len(ts)} |")
lines += ['', '## Tasks', '']
for p in data['phases']:
    lines += [f"### {p['id']} — {p['name']}", '', '| ID | Writer | Reviewer | Risk | Gates | Title |', '|---|---|---|---|---|---|']
    for t in [x for x in data['tasks'] if x['id'].startswith(p['id']+'-')]:
        lines.append(f"| {t['id']} | {t['writer']} | {t['reviewer']} | {t['risk']} | {', '.join(t.get('acceptance_gate_ids', []))} | {t['title']} |")
    lines.append('')
(root/'06_implementation/10_wbs_task_summary.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
print('wrote 06_implementation/10_wbs_task_summary.md')
