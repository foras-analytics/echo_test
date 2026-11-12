from decimal import Decimal
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from echo.core import LATIN_STOP_WORDS, extract_suggestions, normalize, parse_stamp, query
from echo.main import app
from echo.synthetic import generate, references


def msg(time="2026-11-10T10:00:00+01:00", sender="a@example.com", subject="", body=""):
    return dict(sender=sender, sentTime=time, subject=subject, messageText=body)


def channel(name, *messages):
    return dict(name=name, messages=list(messages))


def test_recovery_retains_empty_messages_and_reports_locations():
    data = [channel("A", msg(), msg(subject=42), msg(sender=""), msg(time="2026-11-10T10:00:00")), "broken", channel("A")]
    archive = normalize(data)
    assert len(archive.messages) == 2
    assert archive.messages[1]["subject"] == ""
    assert archive.payload()["summary"]["skippedRecords"] == 3
    assert len(archive.issues) == 5  # optional field, 2 messages, container, repeated name
    assert all(i["location"].startswith("$[") for i in archive.issues)
    assert len(archive.channels) == 2 and archive.channels[0]["id"] != archive.channels[1]["id"]
    assert query(archive, keywords=[dict(id="k", text="Alpha")])["ids"] == []


def test_fractional_precision_offsets_ties_and_identity():
    archive = normalize([channel("A", msg(time="2026-11-10T10:00:00.123456789123456789+01:00"), msg(time="2026-11-10T05:00:00.123456789123456788-04:00"), msg(time="2026-11-10T09:00:00.123456789123456789Z"))])
    assert [m["id"] for m in archive.messages] == ["m0-1", "m0-0", "m0-2"]
    assert archive.instants["m0-0"] - archive.instants["m0-1"] == Decimal("0.000000000000000001")
    instant = archive.messages[1]["instant"]
    assert query(archive, start=instant, end=instant)["ids"] == ["m0-0", "m0-2"]
    assert archive.payload()["summary"]["referenceOffset"] == -240
    assert parse_stamp("1969-12-31T23:59:59.5Z")[0] == Decimal("-0.5")


def test_relationships_count_unique_senders_per_pair_and_keep_isolates():
    a = normalize([channel("A", msg(), msg(), msg(sender="b@example.com")), channel("B", msg(), msg(sender="b@example.com")), channel("C", msg()), channel("Empty")])
    assert a.payload()["relationships"] == [[0, 2, 1, 0], [2, 0, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0]]
    assert a.payload()["summary"]["users"] == 2


def test_matching_literal_fields_or_semantics_and_one_mention():
    a = normalize([channel("A", msg(subject="ALPHA AlphaStatus", body="alpha Alpha"), msg(body="Bravo alpha"), msg(subject="Müller", body="Mueller"), msg(subject="some", body="phrase"), msg(body="some phrase [a-z]."))])
    result = query(a, keywords=[dict(id="a", text="Alpha"), dict(id="b", text="Bravo")])
    assert result["ids"] == ["m0-0", "m0-1"]
    assert result["matches"]["m0-1"] == ["a", "b"]
    assert [s["count"] for s in result["timing"]] == [2, 1]
    assert query(a, keywords=[dict(id="k", text="some phrase")])["ids"] == ["m0-4"]
    assert query(a, keywords=[dict(id="k", text="[a-z]")])["ids"] == ["m0-4"]
    assert query(a, keywords=[dict(id="k", text="Muller")])["ids"] == []


def test_suggestions_count_substrings_and_omit_latin_particles_urls_addresses():
    a = normalize([channel("A", msg(subject="Alpha", body="et ut sed id in ALPHA alpha lorem ipsum dolor und der die"), msg(body="AlphaStatus"), msg(body="https://webword.test/page addressword@example.com Müller"))])
    result = {s["text"]: s["count"] for s in extract_suggestions(a)}
    assert result["alpha"] == 2
    assert result["alphastatus"] == 1
    assert result["müller"] == 1
    assert not set(result) & {"et", "ut", "sed", "id", "in", "webword", "addressword", "example", "com", "https"}
    assert {"lorem", "ipsum", "dolor", "und", "der", "die"} <= set(result)
    assert len(LATIN_STOP_WORDS) <= 40
    for word, count in result.items():
        assert count == len(query(a, keywords=[dict(id="k", text=word)])["ids"])


def test_timing_uses_selected_filters_gaps_and_equal_instants():
    a = normalize([channel("A", msg(subject="Alpha"), msg(time="2026-11-10T10:01:00+01:00", subject="Alpha"), msg(time="2026-11-10T10:01:00+01:00", subject="Alpha")), channel("B", msg(time="2026-11-10T09:00:30Z", body="Alpha"))])
    timing = query(a, keywords=[dict(id="k", text="alpha")])["timing"][0]
    assert [r["gapSeconds"] for r in timing["occurrences"]] == [None, None, 60, 0]
    assert [r["delaySeconds"] for r in timing["firstMentions"]] == [0, 30]
    filtered = query(a, start="2026-11-10T09:00:30Z", keywords=[dict(id="k", text="Alpha")])["timing"][0]
    assert [r["delaySeconds"] for r in filtered["firstMentions"]] == [0, 30]
    assert query(a, channels=[])["ids"] == []
    assert len(query(a, channels=["c1"])["ids"]) == 1
    with pytest.raises(ValueError, match="Start"):
        query(a, start="10", end="1")


def test_empty_archive_and_unsupported_roots():
    a = normalize([channel("Empty")])
    assert a.payload()["summary"]["first"] is None
    assert query(a)["timing"] == []
    assert extract_suggestions(a) == []
    with pytest.raises(ValueError, match="root"):
        normalize({"channels": []})


@pytest.mark.parametrize("stamp", ["2026-02-30T12:00:00Z", "2026-11-10T12:00:00", "bad", 42, None, "2026-11-10T12:00:00+25:00"])
def test_invalid_timestamps(stamp):
    with pytest.raises(ValueError):
        parse_stamp(stamp)


def test_reproducible_demo_matches_checked_in_reference():
    data = generate()
    assert data == generate()
    expected = json.loads((Path(__file__).parents[2] / "fixtures" / "synthetic-reference.json").read_text())
    assert references(data) == expected
    assert expected["messages"] == 7000 and expected["users"] == 100 and expected["channels"] == 15
    archive = normalize(data)
    assert [c["name"] for c in archive.channels] == [f"CH{i:03d}" for i in range(1, 16)]
    assert archive.messages[0]["sentTime"] == "2026-11-01T00:00:00.000000+01:00"
    assert {m["offsetMinutes"] for m in archive.messages} == {60}
    counts = [c["messages"] for c in archive.channels]
    participants = [c["users"] for c in archive.channels]
    assert max(counts) > min(counts) * 8
    assert max(participants) > min(participants) * 5
    daytime = sum(8 <= int(m["sentTime"][11:13]) < 20 for m in archive.messages)
    nighttime = sum(int(m["sentTime"][11:13]) < 6 for m in archive.messages)
    assert daytime > nighttime * 10
    assert len(set(sum(expected["sharedSenderCounts"], []))) > 15
    for activity in expected["keywordActivity"].values():
        assert 10 <= activity["spanHours"] <= 24
        assert 1 <= len(activity["channels"]) <= 4
        assert 5 <= activity["count"] <= 25
    suggestions = extract_suggestions(archive)
    words = {s["text"] for s in suggestions}
    assert {"lorem", "ipsum", "dolor", "gravida", "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"} <= words
    assert len(words - {"alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"}) >= 35  # Keep content-bearing Latin words.



def test_http_import_recovery_errors_and_filters():
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        assert client.delete("/api/archive").status_code == 200
        assert client.post("/api/query", json={}).status_code == 409
        for body in (b"not json", b"{}", b"[NaN]"):
            assert client.post("/api/import", files={"file": ("broken.json", body)}).status_code == 422
        response = client.post("/api/import", files={"file": ("test.json", json.dumps([channel("A", msg(subject="Alpha"), msg(sender=""))]).encode())})
        assert response.status_code == 200
        assert response.json()["summary"]["messages"] == 1
        result = client.post("/api/query", json={"keywords": [{"id": "alpha", "text": "alpha"}]}).json()
        assert result["ids"] == ["m0-0"]
        assert client.post("/api/query", json={"start": "10", "end": "1"}).status_code == 422
        assert client.post("/api/query", json={"start": "Infinity"}).status_code == 422
        assert client.get("/api/suggestions").json()["status"] in ("pending", "ready")
        # Failed replacement leaves the previous archive usable.
        assert client.post("/api/import", files={"file": ("bad.json", b"{")}).status_code == 422
        assert client.post("/api/query", json={}).json()["ids"] == ["m0-0"]
