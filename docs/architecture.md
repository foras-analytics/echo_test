# Architecture and behavior

## Responsibilities

`backend/echo/core.py` contains pure normalization, matching, suggestion extraction, relationships, and timing. `main.py` exposes imports and queries; `synthetic.py` generates the reproducible fixture. One active archive lives in process memory. A successful import replaces it; failed imports do not. API access logs are disabled in the launch command, and message content is not logged.

`frontend/src/store.js` owns temporary controls and keyword/group identity, requests authoritative filtered IDs/matches/timing, and discards stale query responses. The frontend receives accepted message text once at import. There is no localStorage, IndexedDB, or recovery system. Suggestions run in a separate backend worker and are polled independently, so browsing does not wait on them.

The API binds to `127.0.0.1`; the built frontend is served from the same origin. Development uses Vite's loopback proxy. No CORS middleware or external fonts/assets are loaded. The intended scope is one trusted local archive, process, and browser tab; this is not a hosted service.

## Identity, time and matching

Channel and message IDs derive from source record positions; equal-looking messages remain distinct. Exact UTC epoch seconds are stored as Decimal values with the complete input fractional part. Sorting and query comparisons retain this precision, and original import order breaks equal-instant ties. The browser uses numeric milliseconds for geometry and display only. The initial/reset interval sends exact bound strings; user-edited datetime controls have millisecond resolution. Source message offsets remain independent. The shared clock is fixed to the earliest accepted message's offset until the archive is replaced.

Case-insensitive literal matching uses Unicode lowercase conversion, independently in subject and body. Phrases cannot cross fields. A message contributes once per keyword. No stemming, accent removal, regex interpretation, translation, or semantic matching occurs. Highlights partition overlapping ranges and use segmented colors; original text is never rewritten or interpreted as HTML.

Suggestions tokenize words, including German umlauts and internal hyphens/apostrophes, and combine case variants. Single-character tokens, 32 demonstrator Latin stop words, URLs, and address-like tokens are omitted at extraction. Latin filler words are retained. Counts use the same substring predicate as queries, including candidates embedded inside longer words. Ties sort alphabetically. The API supplies the top 100 candidates; both visual views use all supplied candidates, up to 100. Suggestions always cover the full archive.

## Context and rendering

`model.js` builds same-channel neighbor intervals around live anchors. Overlapping intervals merge; each row retains the subset of anchors that requires it and whether it is a primary result. Every ID is emitted once. Groups are placed at their earliest anchor's position in the base filtered list. Other primary rows keep their relative order. A filtered row inside a group moves there rather than being copied. New query results permanently discard anchors they exclude.

`VirtualMessages.vue` renders a buffered portion of variable-height rows. A ResizeObserver measures actual row heights; cumulative offsets and binary search locate the render window. Layout changes preserve the top reading timestamp/ID where possible; explicit context actions preserve their anchor's position. Timeline seeking refines the centered position after the newly rendered rows are measured. The explorer stays mounted across screen switches to retain scrolling.

Visible row bounds are measured against the actual scrolling panel. Only visible primary IDs determine the viewport indicator's timestamp minimum and maximum. Context rows consume space without contributing to those bounds. No primary timestamp on screen means no indicator.

The timeline draws all filtered message contributions on a device-scaled canvas. Overlapping ticks darken with density. Keyword matches divide a tick into colored vertical segments. Channel colors label lanes and message borders. Timeline lanes derive from the ordered channel list and the fixed divider index before applying selection, so deselection cannot promote a combined channel. Timeline clicks seek among all primary results; equal-distance ties choose the earlier instant. The timeline panel grows to fit its lanes. It has no hover popups or arrow-key navigation; the message toolbar retains explicit previous/next controls. All analysis uses primary results only.

Channel sorting uses pointer capture on the stable list container, avoiding native drag cancellation when preview rows move. Channels and the divider retain stable keyed entries while their proposed positions update the live lane layout. Dropping within the list commits the displayed arrangement; Escape, pointer cancellation, or an outside release restores the original order/divider. Channel reordering preserves the divider index. The active row and floating label indicate the item being moved, and edge scrolling keeps long lists usable.

Saved keywords have one alphabetical projection shared by setup and explorer controls. Clicking either suggestion view toggles pool membership; removing a saved keyword also removes active filters and timing series. Word/group controls share a compact wrapping row. Each explorer filter section has its own collapse state; collapsing does not change selections.

Timing reports first observed delay relative to each keyword's earliest accepted occurrence in the active dataset, plus successive gaps within each channel. It does not infer transfers or historical first appearances. An occurrence opens its existing row and adds context.

## API

- `GET /api/health`: readiness.
- `POST /api/import`: multipart `file`; validates and replaces the archive on success.
- `POST /api/demo`: generates and activates the sample archive.
- `POST /api/query`: `{ channels?, start?, end?, keywords?: [{ id, text }] }`; returns primary IDs, matched keyword IDs, and timing series. Omitted channel list means all; `[]` means none. Bounds accept exact epoch-second strings or offset-aware ISO strings. Endpoints are inclusive.
- `GET /api/suggestions`: pending/ready/error with ranked terms/counts.
- `DELETE /api/archive`: clears the backend archive.

The synthetic archive starts on November 1, 2026 in a single fixed UTC+01:00 offset. Seeded randomness weights daytime hours, channel-specific daily bursts, unequal message volumes, and unequal teams with bridge users. Each keyword has one 10–24-hour episode, 9–22 occurrences, and at most four channels; fixture references record its bounds and participation. A short Latin particle list replaces the original German stop words. Content-bearing Latin terms remain candidates; no seeded word receives a ranking boost. Cloud sizes use log-scaled counts with a 14 px minimum so rare terms are visible without falsifying their counts.

All six implementation stages in the specification are included, with the subsequent requested UI and synthetic-data refinements. Hosted access, persistence, exports, sender filtering, direct timeline zoom/panning, automatic phrase suggestions, and propagation inference remain outside this demonstrator's scope.

## Visual themes

`theme.js` defines graphite/navy dark and muted slate light themes, with dark as the initial session setting. CSS uses semantic Vuetify tokens for surfaces, borders, text, controls, diagrams, and the canvas timeline. The header switch changes the theme without issuing another archive query. Channel and keyword accents retain their canonical hues and session IDs; their display colors mix toward white or black until they reach 4.5:1 contrast against the theme’s raised surface. The overview, keyword controls, highlights, timing series, and timeline consume those same displayed colors.

IBM Plex Sans and Mono ship in the frontend bundle through Fontsource; there are no runtime font requests to third parties. Small corner radii, stronger dividers, and monospaced time/numeric fields give the interface a technical layout. The timing panel is 440 px wide on the main desktop layout, with split date/time lines and 12–14 px data text.
