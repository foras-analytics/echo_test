# Demonstrator validation

Measured 2026-11-12 on Linux x86_64, AMD Ryzen 7 PRO 5850U (16 logical CPUs), Python 3.12.3, Node 24.19.0, and headless Chromium 158.0.8127.18 through Playwright 1.65.0. Browser viewport: 1440 × 1000. The final smoke check used the production frontend served directly by FastAPI from a separate loopback API process on port 8001 so the desktop session on port 8000 was left intact.

## Correctness

- **15 backend tests pass:** record recovery, optional-field handling, duplicate channel identities, precise fractional timestamps, mixed offsets, chronology/ties, inclusive bounds, invalid timestamps, empty archives, sender intersections, literal matching, a small Latin stop-word list, suggestion/query parity, OR filters, mention counts, first delays, within-channel gaps, reproducibility, and HTTP errors/replacement semantics. The synthetic fixture also checks the November 1 start, single offset, daytime weighting, uneven channel/personnel distributions, and bounded keyword episodes.
- **9 frontend rule tests pass:** overlapping context ownership/deduplication, group placement, filter precedence, neighbor changes, lane compaction without promotion, nearest-result ties, overlapping text highlights, Unicode lowercase index mapping, fixed clocks, exact instant comparison, and accent/text contrast across both themes.
- **14 browser workflows pass:** mixed-record import and empty/fatal states; saving suggestions separately from activation; safe plain-text display and timing; independent contexts and out-of-range neighbors; UTC switching and reversed range validation; both group-deletion outcomes; full-demo virtual scrolling/seeking/screen preservation; viewport shading and context-size updates; channel and divider drag ordering; alphabetic compact keyword rows and toggling from either suggestion view; independent filter collapse; fitting every timeline lane without scrolling; held-pointer preview/commit/cancel behavior; Latin suggestions retaining content words and all eight seeded keywords; and switching themes without changing filters/queries while recoloring graph and timeline and retaining readable timing text; and exact lane sizing across ten individual/combined/empty selection and divider combinations (including the single-lane regression).
- **Production build passes.** The launch script, production HTTP page, sample import, continuous scrolling, and timeline seeking were exercised together with no browser page errors. The list renders a buffered portion of the full sample. The import, overview, keyword, and explorer screens were also inspected visually.

## Responsiveness

Practical targets for this demo machine: sample open below 3 seconds, eight-keyword backend query below 100 ms, timeline seek below 500 ms, and scrolling 95th-percentile frame time below 50 ms. These are local demonstration targets, not production guarantees or hardware-independent CI assertions.

| Measurement | Result |
| --- | ---: |
| Sample click → production overview | 1,508 ms |
| Timeline click → focused, centered row | 139 ms |
| Continuous scroll frame interval, median / p95 | 25.1 / 30.3 ms |
| Normalize 7,000 messages | 102.76 ms |
| Query, no keywords, median / maximum of 20 | 3.40 / 4.92 ms |
| Query, one keyword, median / maximum of 20 | 6.56 / 10.03 ms |
| Query, eight keywords, median / maximum of 20 | 20.92 / 22.30 ms |
| Extract and count 77 suggestion candidates | 437.29 ms |

The browser numbers include automation and rendering overhead. Scroll samples cover 60 animation-frame-driven 160 px steps, discarding two initial samples. The backend measurements exclude HTTP serialization. Suggestions run separately from browsing. The revised sample uses CH001–CH015 with 94–1,117 messages and 4–43 participants per channel. Each keyword has 9–22 matching messages in one 10–24-hour window across at most four channels. The 32-word Latin stop list leaves 77 candidates, including all eight seeded terms and content words such as lorem, ipsum, dolor, and gravida. Both views show those same 77 candidates in the demo; no seeded term receives a ranking adjustment. Cloud sizing is logarithmic, bounded to 14–24 px. Both dark and light modes were visually checked on the import, overview, keyword setup, and explorer screens.

Reproduce backend timings with `uv run python scripts/benchmark.py`. After launching `./scripts/start.sh`, reproduce the production browser smoke/timings with `node frontend/e2e/production-smoke.mjs`. The complete workflow suite is `npm --prefix frontend run test:e2e`; it starts isolated loopback servers on ports 8001/5174. Do not point destructive import tests at an active desktop session.

## Scope and limits

The demonstrator assumes a desktop browser (minimum layout width 1,000 px), one active archive, and one tab. It has no persistence or export. Display and user-edited time fields resolve to milliseconds; exact input fractions remain intact for backend sorting, unedited/reset bounds, matching interval comparisons, and timing calculations. Canvas geometry can overlap messages at the same displayed position. Clicking seeks the nearest primary message. The timeline grows to fit its selected lanes and has no internal scrollbar or arrow-key navigation. Native hover popups have been removed.

Testing used synthetic and malformed fixtures, not a real organization export or production load. The code intentionally makes no propagation/causation inference. More extensive scalability work, real-data usability evaluation, mobile layouts, and hosted access remain outside the specified first demonstration.
