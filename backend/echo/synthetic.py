"""Reproducible localized archive with uneven activity and bounded keyword episodes."""
from datetime import datetime, timedelta, timezone
import random

KEYWORDS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"]
NAMES = [f"CH{i:03d}" for i in range(1, 16)]
START = datetime(2026, 11, 1, tzinfo=timezone(timedelta(hours=1)))
CHANNEL_WEIGHTS = [20, 12, 3, 17, 2, 8, 1, 14, 5, 2, 10, 4, 1, 6, 2]
TEAM_SIZES = [52, 29, 9, 43, 7, 22, 5, 36, 16, 8, 27, 12, 4, 19, 6]
HOUR_WEIGHTS = [.12, .07, .04, .03, .05, .12, .4, 1.1, 2.4, 3.3, 3.8, 3, 1.9, 2.8, 3.6, 3.9, 3.2, 2.2, 1.5, 1.1, .8, .6, .35, .2]
PASSAGES = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt.",
    "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio.",
    "Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula.",
    "Praesent dapibus, neque id cursus faucibus, tortor neque egestas augue.",
]


def generate(seed: int = 42, count: int = 7000) -> list[dict]:
    rng = random.Random(seed)
    channels = [dict(name=name, messages=[]) for name in NAMES]
    # A small shared bridge pool connects unequal teams; every user has a home.
    teams = []
    for ci, size in enumerate(TEAM_SIZES):
        home = [user for user in range(100) if user % 15 == ci]
        bridge = [75 + (ci * 3 + j) % 25 for j in range(max(1, size // 5))]
        local = list(range((ci % 4) * 25, (ci % 4 + 1) * 25))
        others = [user for user in local + list(range(100)) if user not in home + bridge]
        pool = list(dict.fromkeys(home + bridge))
        # Small channels may only include some home users; coverage is added below.
        for user in others:
            if len(pool) >= size:
                break
            pool.append(user)
        teams.append(pool[:size])

    records = []
    for i in range(count):
        day = rng.choices(range(14), weights=[.6, 1.1, 1.4, .9, 1.6, 1.15, .4, .5, 1.3, 1, 1.7, .8, 1.4, .35])[0]
        hour = rng.choices(range(24), weights=HOUR_WEIGHTS)[0]
        instant = START + timedelta(days=day, hours=hour, seconds=rng.random() * 3600)
        # Per-channel daily bursts and different working-hour peaks.
        weights = [weight * (3.0 if (day + ci * 2) % 7 == 0 else .3 if (day + ci) % 5 == 0 else 1) * (1.6 if hour in range(8 + ci % 3, 12 + ci % 3) else 1) for ci, weight in enumerate(CHANNEL_WEIGHTS)]
        ci = rng.choices(range(15), weights=weights)[0]
        user = rng.choice(teams[ci])
        subject = rng.choice(["Lorem ipsum", "Dolor sit amet", "Praesent dapibus", "Curabitur pretium", ""])
        body = rng.choice(PASSAGES) + " " + rng.choice(PASSAGES)
        records.append([instant, ci, user, subject, body])
    if not records:
        return channels
    records.sort(key=lambda row: row[0])
    records[0][0] = START
    # Keep precisely 100 senders represented without making every channel alike.
    for user, row in zip(range(100), records):
        candidates = [ci for ci, team in enumerate(teams) if user in team]
        if not candidates:
            ci = max(range(15), key=lambda index: TEAM_SIZES[index])
            teams[ci].append(user)
        else:
            ci = rng.choice(candidates)
        row[1], row[2] = ci, user

    # Each term occurs only during one 10–24 hour episode and in 2–4 channels.
    # Targets progress through those channels, with some parallel later activity.
    for ki, keyword in enumerate(KEYWORDS):
        begin = START + timedelta(days=1 + ki * 1.45, hours=8 + rng.randrange(5))
        span = timedelta(hours=rng.uniform(10, 24))
        eligible_channels = rng.sample(range(15), rng.randint(2, 4))
        occurrence_count = rng.randint(9, 22)
        for occurrence in range(occurrence_count):
            progress = occurrence / (occurrence_count - 1)
            target = begin + span * progress
            stage = min(len(eligible_channels) - 1, int(progress * len(eligible_channels)))
            ci = eligible_channels[stage if occurrence < 3 or rng.random() < .75 else rng.randrange(stage + 1)]
            # Allocate an existing record so the archive remains exactly count messages.
            index = min(range(len(records)), key=lambda i: abs((records[i][0] - target).total_seconds()) + (1e9 if len(records[i]) > 5 else 0))
            row = records[index]
            row[0], row[1], row[2] = target, ci, rng.choice(teams[ci])
            term = keyword.lower() if occurrence % 4 == 1 else keyword
            if occurrence % 3 == 0:
                row[3] += " · " + term
            else:
                row[4] += " " + term + (f" {term}" if occurrence % 5 == 0 else "") + ("Status" if occurrence % 7 == 0 else "") + "."
            row.append(keyword)

    # For tiny custom counts, do not claim a full-size fixture; every row remains valid.
    for instant, ci, user, subject, body, *_ in sorted(records, key=lambda row: row[0]):
        channels[ci]["messages"].append(dict(sender=f"person{user:03d}@example.com", sentTime=instant.isoformat(timespec="microseconds"), subject=subject, messageText=body))
    return channels


def references(data: list[dict]) -> dict:
    from .core import normalize, query
    archive = normalize(data)
    keyword_activity = {}
    for term in KEYWORDS:
        result = query(archive, keywords=[dict(id="k", text=term)])
        occurrences = [m for m in archive.messages if m["id"] in set(result["ids"])]
        keyword_activity[term] = dict(count=len(occurrences), channels=sorted({m["channelId"] for m in occurrences}),
            first=occurrences[0]["sentTime"] if occurrences else None, last=occurrences[-1]["sentTime"] if occurrences else None,
            spanHours=float((archive.instants[occurrences[-1]["id"]] - archive.instants[occurrences[0]["id"]]) / 3600) if occurrences else 0)
    return dict(seed=42, messages=len(archive.messages), channels=len(archive.channels), users=len({m["sender"] for m in archive.messages}),
                keywordCounts={term: activity["count"] for term, activity in keyword_activity.items()}, keywordActivity=keyword_activity,
                channelActivity=[dict(name=c["name"], messages=c["messages"], users=c["users"]) for c in archive.channels],
                sharedSenderCounts=archive.payload()["relationships"],
                alphaFirstOccurrences=query(archive, keywords=[dict(id="alpha", text="Alpha")])["timing"][0]["occurrences"][:8])
