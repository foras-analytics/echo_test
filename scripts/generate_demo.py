#!/usr/bin/env python3
"""Write reproducible development fixtures, never user archives."""
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from echo.synthetic import generate, references

root = Path(__file__).resolve().parents[1] / "fixtures"
data = generate()
(root / "synthetic.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
(root / "synthetic-reference.json").write_text(json.dumps(references(data), indent=2) + "\n")
print(f"Generated {root / 'synthetic.json'} and its reference measurements.")
