# ECHO

A local chat archive explorer implementing [the demonstrator specification](project_idea_v2.md), using Vue 3, Vuetify 3, D3, and Python/FastAPI. All archive data and interaction state are temporary. No account, external processing service, database, or hosting is used.

## Run

Requires Python 3.12+, [uv](https://docs.astral.sh/uv/getting-started/installation/), and Node.js 20.19+ or 22.12+ with npm. From this directory:

```bash
./scripts/start.sh
```

Open **http://127.0.0.1:8000**. The script installs Python dependencies, installs frontend dependencies on first run, builds the frontend, and starts the API bound to loopback. Dependency installation needs internet access; the application itself works offline. Press Ctrl+C to stop.

Click **Try the sample archive**, or import a local JSON file. The sample contains exactly 7,000 messages, 15 channels, 100 distinct senders, and two weeks starting November 1, 2026 in UTC+01:00. Channels are named CH001–CH015. Daytime traffic, channel activity, and participant counts vary substantially. Each NATO keyword appears 9–22 times in a single 10–24-hour window spanning at most four channels. `fixtures/synthetic.json` is also available for file import.

## Workflow

1. **Overview:** archive statistics, expandable import problems, channel counts, and a circular chord diagram. Expand the channel-pair list for exact shared-sender counts. Overview always describes the full accepted archive.
2. **Keyword setup:** a ranked list and word cloud using the same candidates (up to 100) and message counts. The demonstrator excludes a short Latin stop-word list while retaining content words. Cloud size uses a logarithmic count scale so rare words remain visible; the list retains exact counts. Click either to add or remove a saved keyword. Saving does not activate filters. Enter literal phrases and move terms into groups. Saved terms are ordered alphabetically, with compact word/group rows. A group's Delete button opens both deletion choices directly beneath it.
3. **Message explorer:** choose channels and keywords, set inclusive time bounds, read highlighted results, and independently open message contexts. Drag channels or the divider to preview their placement and the timeline lanes while holding them. Release inside the list to keep the preview; release outside or press Escape to cancel. The list scrolls when dragging near its edges. Time, keyword, and channel sections collapse independently. Arrow buttons and the individual-lane count provide keyboard alternatives. The divider starts after ten channels. Deselection never promotes channels across it.
4. **Timeline:** each eligible message contributes a tick; active keyword matches use segmented colors. Click to center the nearest result, including messages already grouped in context. Use the previous/next match buttons for stepping. The timeline grows to fit all visible lanes without its own scrollbar. The shaded viewport span describes only visible primary messages. Context-only messages do not affect analysis or ticks.
5. **Timing:** select keywords, then open Timing to inspect each keyword separately, its channel-first delays, and within-channel gaps. Click an occurrence to open that message in context.

The header’s **Dark / Light** switch changes between graphite/navy and muted slate themes; dark is the default. Both themes use IBM Plex Sans and IBM Plex Mono fonts bundled locally, with channel/keyword accents adjusted for contrast. The timing panel uses larger 12–14 px details. Theme switching preserves filters, keywords, and the reading position.

Settings in the header switch source offsets/UTC and update the number of context neighbors on each side (default 3; demo control range 0–100). Switching screens preserves the current reading position. Refresh returns to import; replacing an archive resets filters, keywords, and contexts. Failed replacement imports leave the previous archive usable.

## Input

```json
[
  {
    "name": "Channel A",
    "messages": [
      {
        "sender": "person@example.com",
        "sentTime": "2026-11-10T10:20:30.456+01:00",
        "subject": "Alpha",
        "messageText": "Lorem ipsum."
      }
    ]
  }
]
```

`sender` and an offset-aware `sentTime` are required. `Z`, colon/compact numeric offsets, and fractional seconds are accepted. Missing/null subject or body becomes empty text. Non-text optional fields generate warnings but retain the message. Bad messages and unusable channels are skipped, with JSON locations in the issue report. Repeated channel names retain distinct IDs. Sender strings are exact identities. Bodies are rendered as plain text with line breaks; HTML and Markdown are never interpreted.

`fixtures/malformed.json` exercises recovery, repeated names, empty text, mixed offsets, and invalid records. Invalid JSON syntax or a non-list root is fatal. Empty accepted archives remain inspectable.

## Development and checks

```bash
uv sync --frozen
npm --prefix frontend ci
```

Run these in separate terminals for frontend hot reload:

```bash
uv run uvicorn echo.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log
```

```bash
npm --prefix frontend run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the loopback backend. API documentation is at http://127.0.0.1:8000/docs. To rebuild the single-server version, run `npm --prefix frontend run build` and restart the backend.

```bash
uv run pytest -q
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e
```

Browser tests start isolated servers on ports **8001** and **5174**, leaving a running desktop session on port 8000 untouched. Both test ports must be free. Tests run sequentially because each API process deliberately owns one shared archive. The fixture generator is reproducible:

```bash
uv run python scripts/generate_demo.py
```

Expected keyword counts and occurrence measurements are tracked in `fixtures/synthetic-reference.json`. See [architecture and behavior](docs/architecture.md) and [validation notes](docs/validation.md).

The short Latin stop list is `a ab ac ad atque aut cum de dum enim esse est et ex id in nam nec neque non per pro quae qui quod sed si sine sit sunt ut vel`. It applies to suggestion extraction only, never literal search or counts. This demonstrator list replaces the earlier German baseline; it leaves `lorem`, `ipsum`, `dolor`, `gravida`, and other content words in the ranking. The [CLTK Latin stop-word documentation](https://v1.cltk.org/en/latest/cltk.stops.html#module-cltk.stops.lat) provides background on Latin stop-word filtering. No term is selected or promoted because it is a seeded keyword.
