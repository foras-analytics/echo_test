#!/usr/bin/env python3
"""Small repeatable demo-scale timings, separate from correctness checks."""
from pathlib import Path
from statistics import median
import platform
import sys
from time import perf_counter
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from echo.core import extract_suggestions, normalize, query
from echo.synthetic import generate, KEYWORDS

raw = generate()
begin = perf_counter()
archive = normalize(raw)
print(f"Python {platform.python_version()} · {platform.system()} {platform.machine()}")
print(f"Normalize 7,000 messages: {(perf_counter() - begin) * 1000:.2f} ms")
for count in (0, 1, 8):
    keywords = [dict(id=str(i), text=word) for i, word in enumerate(KEYWORDS[:count])]
    times = []
    for _ in range(20):
        begin = perf_counter()
        query(archive, keywords=keywords)
        times.append((perf_counter() - begin) * 1000)
    print(f"Query {count} keywords: median {median(times):.2f} ms, max {max(times):.2f} ms (20 runs)")
begin = perf_counter()
items = extract_suggestions(archive)
print(f"Suggestions ({len(items)} candidates): {(perf_counter() - begin) * 1000:.2f} ms")
