"""Pure archive normalization and analysis. No filesystem writes or external services."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, localcontext
import re
from collections import defaultdict

CHANNEL_COLORS = ["#447ba4", "#ca8259", "#6b987c", "#9b7caa", "#c19b43", "#528f98", "#ba7587", "#7c8d53", "#7881ba", "#b26b55", "#509c8d", "#aa87a2", "#a59b66", "#6f91a1", "#9b8271"]
STAMP = re.compile(r"^(\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2})([.,]\d+)?(Z|[+-]\d{2}:?\d{2})$")
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
# A deliberately small demonstrator list of Latin particles/pronouns. Content words
# such as lorem, ipsum, dolor and gravida remain candidates. No seeded terms are special.
LATIN_STOP_WORDS = frozenset("a ab ac ad atque aut cum de dum enim esse est et ex id in nam nec neque non per pro quae qui quod sed si sine sit sunt ut vel".split())


def parse_stamp(value: str) -> tuple[Decimal, int]:
    """Return exact epoch seconds and fixed source offset, retaining arbitrary fractions."""
    if not isinstance(value, str) or not (match := STAMP.fullmatch(value)):
        raise ValueError("Expected an ISO 8601 timestamp with seconds and an explicit offset (e.g. 2026-11-10T10:20:30.456+01:00).")
    base, fraction, offset = match.groups()
    dt = datetime.fromisoformat(base.upper() + offset.replace("Z", "+00:00"))
    delta = dt.astimezone(timezone.utc) - EPOCH
    with localcontext() as ctx:
        ctx.prec = max(40, len(fraction or "") + 18)
        instant = Decimal(delta.days * 86400 + delta.seconds) + Decimal("0." + fraction[1:] if fraction else "0")
    return instant, int(dt.utcoffset().total_seconds() / 60)


def bound(value: str | None) -> Decimal | None:
    if value is None:
        return None
    try:
        result = Decimal(value)
    except Exception:
        return parse_stamp(value)[0]
    if not result.is_finite():
        raise ValueError("Time bounds must be finite.")
    return result


@dataclass
class Archive:
    filename: str
    channels: list[dict] = field(default_factory=list)
    messages: list[dict] = field(default_factory=list)
    issues: list[dict] = field(default_factory=list)
    instants: dict[str, Decimal] = field(default_factory=dict)
    texts: dict[str, tuple[str, str]] = field(default_factory=dict)
    suggestions: list[dict] | None = None
    suggestion_error: str | None = None

    def issue(self, location: str, reason: str, skipped: bool = False):
        self.issues.append(dict(location=location, reason=reason, skipped=skipped))

    def payload(self):
        users = {m["sender"] for m in self.messages}
        participants = [{m["sender"] for m in self.messages if m["channelId"] == c["id"]} for c in self.channels]
        matrix = [[0 if i == j else len(a & b) for j, b in enumerate(participants)] for i, a in enumerate(participants)]
        first = self.messages[0] if self.messages else None
        last = self.messages[-1] if self.messages else None
        return dict(filename=self.filename, channels=self.channels, messages=self.messages, issues=self.issues, relationships=matrix,
                    summary=dict(channels=len(self.channels), users=len(users), messages=len(self.messages), skippedRecords=sum(i["skipped"] for i in self.issues),
                                 first=first, last=last, spanSeconds=float(self.instants[last["id"]] - self.instants[first["id"]]) if first else 0,
                                 referenceOffset=first["offsetMinutes"] if first else 0))


def normalize(data: object, filename: str = "archive.json") -> Archive:
    if not isinstance(data, list):
        raise ValueError("The JSON root must be a list of channels, each with a name and a messages list.")
    archive = Archive(filename)
    names = set()
    order = 0
    for ci, channel in enumerate(data):
        loc = f"$[{ci}]"
        if not isinstance(channel, dict) or not isinstance(channel.get("name"), str) or not channel["name"].strip() or not isinstance(channel.get("messages"), list):
            archive.issue(loc, "Skipped channel: expected a nonempty name and a messages list.", True)
            continue
        cid = f"c{ci}"
        if channel["name"] in names:
            archive.issue(loc + ".name", "Repeated channel name; retained as a separate channel.")
        names.add(channel["name"])
        count, senders = 0, set()
        for mi, raw in enumerate(channel["messages"]):
            mloc = f"{loc}.messages[{mi}]"
            if not isinstance(raw, dict) or not isinstance(raw.get("sender"), str) or not raw["sender"].strip():
                archive.issue(mloc, "Skipped message: sender must be a nonempty string.", True)
                continue
            try:
                instant, offset = parse_stamp(raw.get("sentTime"))
            except (ValueError, TypeError, OverflowError) as error:
                archive.issue(mloc + ".sentTime", f"Skipped message: {error}", True)
                continue
            text = {}
            for name in ("subject", "messageText"):
                val = raw.get(name)
                if val is None:
                    val = ""
                if not isinstance(val, str):
                    archive.issue(mloc + ".'" + name + "'", "Non-text optional field omitted; message retained.")
                    val = ""
                text[name] = val
            mid = f"m{ci}-{mi}"
            message = dict(id=mid, channelId=cid, sender=raw["sender"], sentTime=raw["sentTime"], offsetMinutes=offset,
                           instant=str(instant), timestampMs=float(instant * 1000), order=order, location=mloc, **text)
            archive.messages.append(message)
            archive.instants[mid] = instant
            archive.texts[mid] = (text["subject"].lower(), text["messageText"].lower())
            order += 1
            count += 1
            senders.add(raw["sender"])
        archive.channels.append(dict(id=cid, name=channel["name"], color=CHANNEL_COLORS[len(archive.channels) % len(CHANNEL_COLORS)], messages=count, users=len(senders), sourceIndex=ci))
    archive.messages.sort(key=lambda m: (archive.instants[m["id"]], m["order"]))
    return archive


def matching(archive: Archive, message_id: str, term: str) -> bool:
    subject, body = archive.texts[message_id]
    return term in subject or term in body


def extract_suggestions(archive: Archive) -> list[dict]:
    candidates = set()
    for subject, body in archive.texts.values():
        for text in (subject, body):
            cleaned = re.sub(r"https?://\S+|www\.\S+|\S*@\S+", " ", text)
            candidates.update(w for w in re.findall(r"[^\W\d_]+(?:[-’'][^\W\d_]+)*", cleaned) if len(w) > 1 and w not in LATIN_STOP_WORDS)
    result = [dict(text=word, count=sum(matching(archive, m["id"], word) for m in archive.messages)) for word in candidates]
    return sorted(result, key=lambda s: (-s["count"], s["text"]))


def query(archive: Archive, channels: list[str] | None = None, start: str | None = None, end: str | None = None, keywords: list[dict] | None = None) -> dict:
    begin, finish = bound(start), bound(end)
    if begin is not None and finish is not None and begin > finish:
        raise ValueError("Start must be earlier than or equal to end.")
    channel_set = set(channels) if channels is not None else {c["id"] for c in archive.channels}
    terms = [(k["id"], k["text"].lower()) for k in keywords or [] if k["text"]]
    results, matches = [], {}
    by_keyword = {kid: [] for kid, _ in terms}
    for message in archive.messages:
        mid = message["id"]
        instant = archive.instants[mid]
        if message["channelId"] not in channel_set or (begin is not None and instant < begin) or (finish is not None and instant > finish):
            continue
        hits = [kid for kid, term in terms if matching(archive, mid, term)]
        if terms and not hits:
            continue
        results.append(mid)
        if hits:
            matches[mid] = hits
        for kid in hits:
            by_keyword[kid].append(message)
    timing = []
    for kid, occurrences in by_keyword.items():
        first_by_channel, previous = {}, {}
        earliest = archive.instants[occurrences[0]["id"]] if occurrences else None
        rows = []
        for m in occurrences:
            cid, mid = m["channelId"], m["id"]
            instant = archive.instants[mid]
            first = cid not in first_by_channel
            if first:
                first_by_channel[cid] = dict(channelId=cid, messageId=mid, delaySeconds=float(instant - earliest))
            rows.append(dict(messageId=mid, channelId=cid, gapSeconds=float(instant - previous[cid]) if cid in previous else None,
                             firstDelaySeconds=first_by_channel[cid]["delaySeconds"] if first else None))
            previous[cid] = instant
        timing.append(dict(keywordId=kid, count=len(rows), firstMentions=list(first_by_channel.values()), occurrences=rows))
    return dict(ids=results, matches=matches, timing=timing)
