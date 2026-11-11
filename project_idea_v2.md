# ECHO — Demonstrator specification, version 2

Status: working demonstrator specification; implementation has not started.

Requirements define the demonstrator's behavior. **Proposed defaults** identify implementation recommendations that can be evaluated in the working demo.

## 1. Purpose and demo scope

ECHO explores communication exported from a chat server. A user imports a JSON archive, inspects channel relationships, prepares keywords, and investigates messages and keyword activity across channels and time. Reading surrounding conversation is central to the workflow.

The demonstrator runs locally on a desktop computer. Use Vue and Vuetify for the frontend, Python for the backend, and FastAPI for the API layer. All application state is temporary. Refresh recovery, persistence, and exporting selections or findings are unnecessary.

The representative dataset is approximately 15 channels, 100 users, and 500 messages per day across all channels. A two-week archive therefore contains roughly 7,000 messages. These are demo targets, not production estimates or import limits.

Required in the first demo:

- Local JSON import with partial recovery and inspectable import problems.
- Full-archive statistics and a circular channel relationship diagram.
- A separate keyword setup screen with a ranked list and word cloud side by side.
- A message explorer with filters, channel ordering, and a synchronized timeline.
- Literal keyword matching, comparison, and timing analysis.
- Independently expandable, grouped message context without duplicate rows.
- Synthetic Lorem Ipsum data with seeded keywords.

Deferred or excluded: hosted access, sender filtering, mobile/tablet layouts, draggable panel resizing, automatic phrase suggestions, multi-group keyword membership, semantic search, and export/save/restore. Filtering the overview and relationship diagram, richer propagation analysis, and direct timeline pan/zoom/drag selection can be future expansions.

**Proposed defaults:** one active archive and one browser tab at a time; no live chat connection, accounts, archive editing, or external processing service. These keep implementation aligned with a local demonstrator.

## 2. Screens and navigation

| Screen | Purpose | Data scope |
| --- | --- | --- |
| Import | Choose a local JSON archive and report fatal import failures | Selected file |
| Overview | Statistics, expandable import issues, channel chord diagram | Full successfully imported archive |
| Keyword setup | Discover terms, enter keywords, organize groups | Full archive for automatic suggestions |
| Message explorer | Read, filter, inspect context, compare keyword activity | Active channel, time, and keyword filters, plus explicitly opened context |

Import leads to the overview. Keyword setup has its own screen. The filter panel belongs to the explorer and does not affect the overview or diagram.

**Proposed navigation:** compact header links between the three post-import screens, plus central settings accessible from the header. Switching screens preserves current in-memory state. Keyword setup need not be completed before browsing messages.

## 3. Input contract and import

### 3.1 JSON structure

The JSON root is a list of channels, each with a `name` and a `messages` list.

```json
[
  {
    "name": "Channel A",
    "messages": [
      {
        "sender": "person@example.com",
        "sentTime": "2026-11-10T10:20:30.456+01:00",
        "subject": "Alpha",
        "messageText": "Lorem ipsum dolor sit amet."
      }
    ]
  },
  {
    "name": "Channel B",
    "messages": []
  }
]
```

The sender address is fictional. Attachments and priority are ignored.

| Message field | Required? | Interpretation |
| --- | --- | --- |
| `sender` | Yes | Plain string in email-address form; identifies the sender |
| `sentTime` | Yes | ISO 8601 timestamp with an explicit UTC offset and support for fractional seconds |
| `subject` | No | Plain text; displayed in the header and included in keyword matching and analysis |
| `messageText` | No | Plain-text body; included in keyword matching and analysis |

The enclosing channel supplies channel membership. A message with valid sender and timestamp is accepted even if subject and body are both absent or empty. It contributes to participation and chronological browsing but cannot match a text keyword.

Count every distinct sender address as a user, including bots and system senders. The input does not distinguish personnel from automation.

### 3.2 Recovery and issue reporting

Skip malformed messages and continue importing valid ones. On the overview, show a compact issue summary that expands to reveal affected records and other detected problems, including reasons and record locations where available. Successfully imported records alone contribute to statistics, relationships, suggestions, and exploration.

**Proposed validation defaults:**

- Reject unreadable JSON or an unsupported root structure with an actionable import error; record-level recovery does not repair invalid JSON syntax.
- Require a nonempty sender string and a parseable offset-aware timestamp. Do not require strict email-address validation for a sender name that merely has email-address form.
- Normalize missing or `null` subject/body to empty strings. For unsupported non-text optional values, report an issue and omit that field while retaining an otherwise valid message.
- Skip an unusable channel container with an issue report and continue other channels. Use separate internal channel IDs even if names repeat.
- If no valid messages remain, show the issue report and an empty overview; disable timeline navigation and timing analysis that require message bounds.
- Treat sender strings as exact identities initially; do not infer that different addresses belong to the same person.

### 3.3 Internal identity and chronology

**Proposed model:** assign stable session-local IDs to channels, messages, keywords, and groups. Source IDs are not assumed. Preserve source record locations for issue reporting. Message identity must survive filtering, scrolling, and context expansion; identical-looking records are not automatically duplicates.

Store original text, normalized UTC instants, and original timestamp offsets. Sort messages oldest first; break equal-timestamp ties by original import order. Context neighbors use this same ordering within a channel.

## 4. Time display and settings

Provide a central switch between source time and UTC, defaulting to source time. Individual message timestamps use their own original offsets in source-time mode, including mixed offsets within an archive. UTC mode displays them in UTC. Include milliseconds in displayed message timestamps.

The shared timeline axis and start/end fields need one common clock. In source-time mode, use the first message's offset for these shared controls. In UTC mode, use UTC throughout. Switching display mode does not change the underlying selected instants, global message order, or calculated durations.

The offset is the `+01:00` portion of a timestamp, not a named geographic timezone. Parse the supplied offset; do not infer daylight-saving rules from it.

Central settings also contain the context-neighbor count: default three messages before and three after an expanded message, adjustable by the user.

**Proposed defaults:** take the chronologically earliest valid message as the shared-clock reference, keep it fixed across filters, and label the clock explicitly, such as `UTC+01:00`. Preserve full parsed precision internally, even if it exceeds milliseconds. Adapt timeline tick-label precision to its scale. Changing context size updates existing expansions and their visibility reasons.

## 5. Overview and channel relationships

Display imported filename, channels, distinct user count, earliest/latest message timestamps, elapsed archive span, and the expandable import-issue report.

**Proposed additions:** total included message count, skipped-record count, and per-channel message and participant counts.

The required relationship view is a circular chord diagram, with channels around its edge. Ribbon thickness represents the number of distinct senders who posted in both connected channels. Count each sender once per channel pair regardless of message volume. Relationships are symmetric and represent participation overlap.

Always calculate this diagram from the full successfully imported archive. Explorer filters do not affect it in the first version.

**Proposed presentation:** use the established channel colors, expose exact shared-sender counts on inspection, retain channels with no connections, and omit self-ribbons. A sender active in three channels contributes to all three channel pairs; ribbon totals therefore do not equal the archive's unique-user count.

## 6. Keyword setup

### 6.1 Suggestions

Show a ranked list with message counts and a word cloud side by side, based on the same suggestion data. Suggestions include individual words only; manually entered phrases remain supported.

Extract individual candidate words from subjects and bodies, combining capitalization variants. German is the primary expected language; exclude common German stop words such as `und`, `der`, and `die`.

Rank candidates by the number of distinct messages containing them as case-insensitive substrings, using the explorer's matching rules. Count a message once per candidate across subject and body, regardless of repetitions. Ten messages containing `Alpha` as a word and five additional messages containing `AlphaStatus` give `Alpha` a count of fifteen.

Suggestion counts cover the full archive. They equal explorer result counts for the same single keyword when all channels and the full time range are selected. Narrower explorer filters can reduce results without changing suggestion counts.

**Proposed extraction defaults:** tokenize individual words without stemming or translation; omit URLs and address-like tokens, order equal counts alphabetically, and use a common displayed suggestion subset in the list and cloud. Word size represents message count. Selection in either view is synchronized. Generate suggestions without blocking message browsing.

### 6.2 Keywords and groups

Users can enter a keyword or phrase, retain it for this session, select multiple keywords, or select a named group. Group selection retains each member's individual visual identity for comparison.

Selecting a suggestion on the setup screen saves it to the pool of fast-select keywords available in the explorer. This action does not activate a filter or change existing explorer selections. Keep the saved keyword pool separate from the active keyword selection; filters are activated explicitly in the explorer.

A keyword belongs to at most one group; ungrouped keywords are allowed. Groups do not collapse their members into one concept or one analysis series.

Pressing a group's Delete button expands a small popup panel directly beneath it, offering:

- Delete the group and keep its keywords ungrouped.
- Delete the group together with its keywords.

Perform deletion after the choice. **Proposed:** provide Cancel/dismiss, support renaming groups/keywords and deleting individual keywords, and make moving a keyword between groups explicit. Deleting a keyword removes its active selections and analysis series.

## 7. Message explorer and filters

### 7.1 Layout and messages

Use a fixed-width left panel, a main message panel, and a fixed-height bottom timeline panel. The channel list can be collapsed or hidden. Panels have no draggable resizing controls.

Use compact controls, muted gray surfaces, readable contrast, visible keyboard focus, and meaningful color. Keep explanatory prose and redundant headings out of the working interface. Pair colors with channel/keyword labels so identification does not depend solely on color.

Each compact message card has a channel-colored border and a top line containing timestamp, channel, sender, and subject when present. Render text safely as plain text, preserving body line breaks and wrapping long lines. Do not interpret Markdown or HTML.

With context collapsed, the result stream is globally chronological regardless of channel ordering. When keywords are selected, initially display only matching messages; surrounding nonmatches appear only through explicit context expansion.

**Proposed defaults:** all channels selected, full archive time range, and no active keyword filter on initial entry. No keyword selection means all messages satisfying channel/time filters remain eligible. Preserve the current reading position on changes where possible, otherwise seek near its previous timestamp. Keep long header fields readable through compact truncation with access to their full text.

### 7.2 Shared filter rules

Combine channel and time restrictions with the keyword condition. A message matches selected keywords if either subject or body contains any selected term, including any member of a selected group. Sender filtering is out of scope.

Use start/end date-and-time fields for the interval. A reset-time-range button in the side panel restores the full archive span. Selecting an interval zooms the timeline to it; opening context does not change the interval.

**Proposed defaults:** inclusive endpoints, clear validation for reversed ranges, and a reset that preserves channel/keyword selections. An empty result is a normal state. Scroll position never changes the analysis interval.

### 7.3 Channel order and timeline split

The left-panel channel list supports selection and drag-and-drop ordering. A draggable marker line separates individually displayed channels above it from channels combined into one timeline lane below it. The default marker position is 11 from the top. Moving the marker or a channel immediately updates the split and lane order.

Deselected channels retain their list positions relative to the divider and contribute no timeline data. Their individual timeline lanes disappear, allowing remaining visible lanes to compact upward. The divider does not move, and no channel from below it is promoted to replace a removed lane. Reselecting a channel restores its lane in the established order. Deselected channels do not enter the combined lane.

**Proposed defaults:** interpret position 11 as a divider after ten channel entries; label the combined lane “Other channels” and identify its members on inspection. Use a neutral combined-lane color. Hide the combined lane if it has no selected members. Within the fixed-height timeline, use internal vertical scrolling if the chosen split produces too many lanes.

## 8. Context expansion and visibility

### 8.1 Opening and grouping

Selecting a message's context action expands its same-channel neighbors around it, pushing other results apart. Use the configured number on each side, default three, and fewer at channel boundaries. Neighbors need not match keywords and may extend beyond the selected time interval. Explicitly mark messages outside that interval without changing filters.

Keep the context together in same-channel chronological order, identified by a visual line beside the group. Other-channel results do not interleave its neighbors. Expanded presentation can therefore interrupt global screen chronology.

Multiple expansions stay open independently. Overlapping same-channel expansions merge into one chronological group, retaining an independent close control on each expanded anchor message. Opening another context never closes earlier ones.

### 8.2 One visible row per message

Track visibility reasons by stable message ID:

- The message satisfies the active filters.
- The message is required by a particular open context.

A row can have several context reasons and a filter-match reason simultaneously. Render each message once. Closing an expansion removes only its reasons; remove a row only when no reasons remain. Closing one anchor does not close other expansions.

**Proposed placement rule:** a message already present as a filtered result moves into its context group rather than being copied. Place each merged group at its earliest expanded anchor's position in the base filtered list; keep remaining ungrouped results in their original relative order. Recompute groups after opening, closing, or changing neighbor count. This resolves overlapping ownership without requiring global ordering inside the expanded display.

### 8.3 Filter precedence

Filters are the top-level deciders. A filter change that excludes an expanded anchor removes its expansion and releases its context reasons. Rows needed by other eligible expansions or matching filters remain.

An eligible anchor can expose same-channel neighbors outside the time interval or keyword filter. This exception belongs to a live expansion and does not widen the base filtered dataset.

**Proposed defaults:** discarded expansions do not automatically reopen when filters broaden; archive reset/replacement clears expansions. Preserve the selected anchor's viewport position when expanding or closing. Offer previous/next match navigation.

## 9. Timeline and keyword timing

### 9.1 Timeline display and navigation

Show one small vertical tick per eligible message in individual or combined lanes. Use consistent channel colors across filters, message borders, and individual timeline lanes.

The timeline uses the same channel, time, and keyword filters as the base result list. With active keyword filtering, remove nonmatches entirely; do not retain faint background activity. Context-only messages do not add timeline ticks or expand its selected time span.

Clicking the timeline centers the nearest matching message on either side of the clicked instant, as closely as available content allows. **Proposed defaults:** use the earlier message for equal-distance ties, center its existing row if grouped, and retain the empty state when nothing matches.

A translucent viewport indicator spans the earliest and latest timestamps of primary messages currently visible in the message panel. A primary message is one satisfying the active filters, even if its row is also part of a context group. Context-only rows do not contribute timestamps to this indicator. They consume screen space, so expanding context can reduce the number of visible primary messages and shorten the highlighted span. Do not compensate by including primary messages that have been pushed off screen.

Use timestamp minimum/maximum rather than the first/last row positions, since expanded grouping can interrupt screen chronology. The indicator describes the bounds of visible primary messages, not a guarantee that every intervening message is visible. **Proposed edge handling:** hide the indicator if no primary messages are on screen; use a narrow visible marker when only one timestamp is represented.

**Proposed density handling:** preserve all eligible message contributions while allowing overlapping ticks at wide scales. Use overdraw/density cues and inspection rather than implying every message is individually distinguishable at every zoom level.

### 9.2 Keyword markers and matching

Use distinct markers for selected keywords. For a message matching several keywords, try one marker with a colored segment per matching keyword. Repetition of a term does not add segments. Evaluate readability in the demo.

Matching is literal, case-insensitive substring matching. Highlight all matching text in subject and body, preserving original text. `Alpha` matches `Alphabet`; `Müller` and `Mueller` remain distinct. No regex, stemming, synonyms, accent removal, translation, or semantic matching. Spaces and punctuation in phrases remain literal.

Count one mention per keyword per message for timeline and timing analysis, even when the term repeats across subject and body. **Proposed:** search those fields independently, so a phrase cannot start in the subject and finish in the body. Reserve channel colors for borders/lane labels and keyword colors for highlights/marker segments. Handle overlapping text matches with layered indicators or an inspection label exposing all terms.

### 9.3 Timing measurements

For each keyword, show:

- Within-channel gaps between successive matching messages.
- Each channel's first observed mention and its delay from the earliest mention across the selected dataset.

Calculate using UTC-normalized instants and active filters. The earliest observed mention has zero delay; equal timestamps can produce zero gaps. Later occurrences remain visible so parallel activity can be inspected.

Do not label every alternation between channels as a meaningful transfer. Once discussions run in parallel, globally consecutive cross-channel gaps may be uninformative. First-observed appearance is bounded by the archive and active filters, not necessarily the historical first mention. More advanced activity episodes or propagation models are deferred.

**Proposed detail view:** a compact occurrence list or inspection panel exposes keyword, timestamp, channel, sender, within-channel gap, and first-appearance delay where applicable. A selected occurrence opens its message in context. Exact placement is an implementation design choice; the measurements must be accessible rather than encoded only by marker spacing.

## 10. Synthetic dataset

Generate approximately 7,000 messages across 15 channels and 100 users over two weeks. Use Lorem Ipsum subjects/bodies with eight seeded keywords from the start of the NATO alphabet, using the requested spelling `Alpha`:

- `Alpha`
- `Bravo`
- `Charlie`
- `Delta`
- `Echo`
- `Foxtrot`
- `Golf`
- `Hotel`

Sprinkle these keywords into the synthetic messages. Keep content unobtrusive and generation simple; realistic conversation and German template text are unnecessary.

German remains the primary language of real input and the stop-word baseline. Lorem Ipsum demonstrates extraction and ranking but does not itself exercise German stop-word filtering. Do not silently hide Latin filler words to make seeded terms rank higher.

**Proposed generation details:** use reproducible randomness and known sender overlaps. Seed subject/body matches, capitalization variants, repeated terms, substrings, multi-keyword messages, known within-channel gaps, staggered first appearances, and parallel later activity. Vary Lorem Ipsum passages and keyword frequencies so the suggestion display is useful without changing its rules. Keep malformed-record examples in a separate fixture. Retain expected counts and times as development references.

## 11. Implementation and validation

### 11.1 Architecture and session lifecycle

Run the frontend and FastAPI backend on the local computer. Keep imported data and state temporary; the original selected file is unchanged. Refresh can return to import and require loading the file again. No recovery or export machinery is required.

**Proposed responsibilities:** frontend owns controls, rendering, timeline drawing, scrolling, and temporary interaction state; backend owns validation, normalization, summaries, keyword queries, and suggestion extraction. Keep one archive in backend memory, bind the API to loopback, avoid logging message contents, and replace/reset the dataset explicitly. No complex timeout or multi-tab isolation system is needed for the assumed demo use.

Stable message IDs must connect list rendering, context ownership, and timeline seeking. Fluid scrolling matters with variable-height messages and expanding groups. **Proposed:** render a buffered visible portion of the stream and choose indexing/pagination based on measurement at the agreed scale.

Exact panel dimensions, sort tie-breaks, reference-message selection, issue formatting, and marker collision handling can use the proposed defaults and be evaluated during implementation. The synthetic dataset provides the initial development baseline; a real multi-channel export or production-volume estimate is not a prerequisite.

### 11.2 Suggested build order

1. Input normalization, import report, reproducible synthetic archive.
2. Overview statistics and full-archive chord diagram.
3. Chronological explorer, channel controls, time range, central settings.
4. Synchronized timeline, split lanes, centered navigation.
5. Keyword setup, suggestions, groups, matching and timing measurements.
6. Grouped context, deduplication, filter precedence, and integrated performance checks.

All six stages belong to the initial demo. Later refinements do not replace the required initial versions.

### 11.3 Review scenarios

| Scenario | Expected result |
| --- | --- |
| Import mixed valid/invalid records | Valid records load; issue report exposes exclusions; calculations use included records |
| Message has only sender/time | Included in activity and browsing; no text-keyword match |
| Compare two channels | Ribbon weight equals the distinct sender-set intersection |
| Change explorer filters | Overview stays unchanged; base message results, timeline, and timing analysis agree |
| Toggle/reorder channels or move divider | Selection preserves list positions; only explicit ordering/divider changes alter the split |
| Deselect an individual channel | Its lane disappears and remaining lanes compact; divider stays fixed and no combined channel is promoted |
| Choose/reset time interval | Timeline fits that interval or full archive span; scrolling does not alter the interval |
| Switch UTC/source time | Display changes; selected instants, ordering, and durations remain unchanged |
| Click timeline gap | Nearest matching message is centered where possible |
| Match repeated/multiple terms | All text matches highlighted; one contribution per keyword/message; segmented markers distinguish terms |
| Open overlapping contexts | Chronological same-channel grouping, one row per message, independent close controls |
| Close/filter out one anchor | Only its ownership reasons removed; rows needed elsewhere stay visible |
| Open out-of-range context | Neighboring rows are marked; timeline and active interval stay unchanged |
| Expand context in the viewport | Indicator uses only primary messages still on screen; context-only timestamps and primary rows pushed off screen do not contribute |
| Inspect suggestions | List and cloud agree on words/counts; German stop words excluded |
| Count suggested `Alpha` | Whole-word and embedded substring matches both count, once per message across subject and body; full-archive single-keyword explorer results agree |
| Save a suggested keyword | Added to the explorer's fast-select pool; active filters remain unchanged |
| Delete a group | Inline choice offers keeping its keywords or deleting them too |
| Refresh | Reimport is acceptable; no session recovery required |

**Proposed performance baseline:** evaluate loading, search, timeline seeking, and scrolling on the same roughly 7,000-message fixture in a desktop browser. Record the device/browser and measured responsiveness. Set practical thresholds during implementation; production-scale benchmarking is outside current scope.

