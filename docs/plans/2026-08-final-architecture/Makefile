.PHONY: validate summary checksums

validate:
	python scripts/validate_pack.py

summary:
	python scripts/render_task_summary.py

checksums:
	find . -type f ! -name SHA256SUMS ! -path './.git/*' -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
