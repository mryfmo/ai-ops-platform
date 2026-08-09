.PHONY: validate summary checksums

validate:
	uv run --with pyyaml --with jsonschema python scripts/validate_pack.py

summary:
	uv run --with pyyaml python scripts/render_task_summary.py

checksums:
	find . -type f ! -name SHA256SUMS ! -path './.git/*' -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS
