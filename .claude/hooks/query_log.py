#!/usr/bin/env python3
# 根拠: ADR-0031 — CompactionDB project-local opt-in。
"""Backward-compatible alias for the original CompactionDB query_log.py."""
from __future__ import annotations

import sys
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1] / "contextdb"
sys.path.insert(0, str(PACKAGE_ROOT))

from contextdb.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
