"""Generating cards (rules.md §2.2.1, GEN-*). The LLM is replaced by a fake that reads the prompt."""

import random
import re
import threading
import time
from collections import Counter

import pytest

from app import generation, llm
from app.generation import (
    Cell,
    Deduper,
    check_card,
    largest_remainder,
    pick_provider,
    plan,
    plan_batches,
)
from app.models import GenerationSpec

# ---------- planning (GEN-2) ----------


def test_largest_remainder_adds_up_exactly():
    assert largest_remainder(100, {"science": 20, "history": 80}) == {"science": 20, "history": 80}
    assert largest_remainder(10, {"a": 1, "b": 1, "c": 1}) == {"a": 4, "b": 3, "c": 3}  # ties go to the first
    assert sum(largest_remainder(7, {"a": 0.3, "b": 0.3, "c": 0.4}).values()) == 7


def test_plan_meets_every_mix_exactly():
    spec = GenerationSpec(
        count=100,
        categories=[{"category_id": 1, "weight": 20}, {"category_id": 2, "weight": 80}],
        difficulty={"easy": 50, "medium": 0, "hard": 50},
        types={"multiple_choice": 30, "open": 70},
    )
    cells = plan(spec)
    assert sum(cells.values()) == 100

    def total(key):
        out = Counter()
        for cell, n in cells.items():
            out[key(cell)] += n
        return dict(out)

    assert total(lambda c: c.category_id) == {1: 20, 2: 80}
    assert total(lambda c: c.difficulty) == {1: 50, 3: 50}
    assert total(lambda c: c.kind) == {"multiple_choice": 30, "open": 70}
    # The mixes combine evenly: each category gets its share of every difficulty and type
    assert cells[Cell(1, 1, "multiple_choice")] == 3 and cells[Cell(2, 3, "open")] == 28


def test_plan_is_exact_for_awkward_numbers():
    rng = random.Random(7)
    for _ in range(200):
        n_cats = rng.randint(1, 6)
        spec = GenerationSpec(
            count=rng.randint(1, 200),
            categories=[{"category_id": i, "weight": rng.choice([0, 1, 3, 7.5, 33])} for i in range(n_cats - 1)] + [{"category_id": 99, "weight": 1}],
            difficulty={"easy": rng.randint(0, 5), "medium": rng.randint(0, 5), "hard": rng.randint(1, 5)},
            types={"multiple_choice": rng.randint(0, 3), "open": rng.randint(1, 3)},
        )
        cells = plan(spec)
        assert sum(cells.values()) == spec.count
        cat_w = {c.category_id: c.weight for c in spec.categories if c.weight}
        expected = largest_remainder(spec.count, cat_w)
        for cat, n in expected.items():
            assert sum(v for c, v in cells.items() if c.category_id == cat) == n


def test_batches_split_each_category_evenly():
    cells = {Cell(1, 1, "open"): 30, Cell(1, 3, "multiple_choice"): 15, Cell(2, 2, "open"): 5}
    batches = plan_batches(cells, 20)
    assert [(b.category_id, b.size) for b in batches] == [(1, 15), (1, 15), (1, 15), (2, 5)]
    for b in batches[:3]:  # the same mix in every call, not 20 of one kind first
        assert b.needs == Counter({Cell(1, 1, "open"): 10, Cell(1, 3, "multiple_choice"): 5})
    assert sum((b.needs for b in batches), Counter()) == Counter(cells)


def test_spec_validation():
    with pytest.raises(ValueError):
        GenerationSpec(count=201, categories=[{"category_id": 1}])
    with pytest.raises(ValueError):
        GenerationSpec(count=10, categories=[{"category_id": 1, "weight": 0}])
    with pytest.raises(ValueError):
        GenerationSpec(count=10, categories=[{"category_id": 1}, {"category_id": 1}])
    with pytest.raises(ValueError):
        GenerationSpec(count=10, categories=[{"category_id": 1}], types={"multiple_choice": 0, "open": 0})


# ---------- duplicates (GEN-3) and card checks (GEN-4) ----------


def test_deduper():
    d = Deduper()
    d.add("What is the capital of France?", "Paris")
    assert d.is_duplicate("what is the capital of france", "paris")  # case and punctuation
    assert d.is_duplicate("Which city is France's capital?", "Paris")  # reworded, same answer
    assert not d.is_duplicate("What is the capital of Spain?", "Madrid")
    assert not d.is_duplicate("Which river flows through Paris?", "Seine")
    d.add("¿Quién pintó la Mona Lisa?", "Leonardo da Vinci")
    assert d.is_duplicate("Quien pinto la Mona Lisa", "Leonardo")  # accents
    assert d.add_new("Who painted The Last Supper?", "Leonardo da Vinci")
    assert not d.add_new("Who painted The Last Supper?", "Leonardo da Vinci")


def test_check_card():
    rng = random.Random(1)
    mc = {"question": "2+2?", "type": "multiple_choice", "difficulty": "easy", "options": ["3", "4", "5", "6"], "answer": "4"}
    cell, card = check_card(mc, 5, rng)  # type: ignore[misc]
    assert cell == Cell(5, 1, "multiple_choice") and card.answer == "4" and sorted(card.options) == ["3", "4", "5", "6"]
    # The answer is matched to its option ignoring case
    assert check_card({**mc, "answer": "paris", "options": ["Paris", "Rome"]}, 5, rng)[1].answer == "Paris"  # type: ignore[index]
    assert check_card({**mc, "answer": "7"}, 5, rng) is None  # CRD-1
    assert check_card({**mc, "options": ["4", "4", "5"]}, 5, rng) is None
    assert check_card({**mc, "difficulty": "brutal"}, 5, rng) is None
    assert check_card({**mc, "question": "  "}, 5, rng) is None
    open_card = check_card({**mc, "type": "open", "options": ["ignored"]}, 5, rng)
    assert open_card and open_card[1].options is None


def test_pick_provider():
    none = {"openai": None, "gemini": None}
    both = {"openai": "x", "gemini": "y"}
    with pytest.raises(generation.GenerationUnavailable):
        pick_provider(none, None)
    with pytest.raises(generation.GenerationUnavailable) as e:
        pick_provider(both, None)
    assert e.value.needs_choice
    assert pick_provider(both, "gemini") == "gemini"
    assert pick_provider({"openai": None, "gemini": "y"}, None) == "gemini"
    with pytest.raises(generation.GenerationUnavailable):
        pick_provider({"openai": None, "gemini": "y"}, "openai")


# ---------- the API, with a fake LLM ----------

NEED = re.compile(r"^- (\d+) (easy|medium|hard) (multiple_choice|open)$", re.M)


class FakeLlm:
    """Answers like a model would: the cards each prompt asks for, numbered so they're unique.
    `extra(prompt)` can add cards to a reply (duplicates, broken ones)."""

    def __init__(self, extra=lambda prompt: [], short_by: int = 0):
        self.prompts: list[str] = []
        self.extra = extra
        self.short_by = short_by  # the first reply leaves out this many cards
        self.n = 0
        self.lock = threading.Lock()

    def __call__(self, provider, api_key, system, user, schema, attempts=3):
        assert api_key.startswith("sk-test") or api_key.startswith("AIza-test")
        with self.lock:
            self.prompts.append(user)
            cards = []
            for count, level, kind in NEED.findall(user):
                for _ in range(int(count)):
                    self.n += 1
                    q = f"Unique fact number {self.n} ({level}, {kind})?"
                    if kind == "multiple_choice":
                        cards.append({"question": q, "type": kind, "difficulty": level, "options": ["a", "b", "c", f"x{self.n}"], "answer": f"x{self.n}"})
                    else:
                        cards.append({"question": q, "type": kind, "difficulty": level, "options": [], "answer": f"answer {self.n}"})
            if self.short_by and len(self.prompts) == 1:
                cards = cards[self.short_by :]
            return {"cards": self.extra(user) + cards}


def _set_keys(client, root, org_id, openai="sk-test-openai-key-1111", gemini=None):
    r = client.patch(f"/api/organizations/{org_id}", json={"openai_api_key": openai, "gemini_api_key": gemini}, headers=root)
    assert r.status_code == 200, r.text


def _wait(client, auth, deck_id, timeout=10.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        job = client.get(f"/api/decks/{deck_id}/generation", headers=auth).json()
        if job is None or job["status"] != "running":
            return job
        time.sleep(0.02)
    raise AssertionError("generation didn't finish")


@pytest.fixture
def fake(monkeypatch):
    f = FakeLlm()
    monkeypatch.setattr(llm, "complete_json", f)
    return f


def _body(acme, count=30, **extra):
    cats = acme["cats"]
    return {
        "count": count,
        "categories": [{"category_id": cats["Science"]["id"], "weight": 20}, {"category_id": cats["History"]["id"], "weight": 80}],
        "difficulty": {"easy": 50, "medium": 0, "hard": 50},
        "types": {"multiple_choice": 50, "open": 50},
        **extra,
    }


def test_provider_choice(client, root, world, acme, fake):
    ana, deck = acme["auth"], acme["deck"]
    url = f"/api/decks/{deck['id']}/generation"
    assert client.get(f"{url}/providers", headers=ana).json() == []
    r = client.post(url, json=_body(acme), headers=ana)
    assert r.status_code == 409 and "no OpenAI or Gemini API key" in r.json()["detail"]

    _set_keys(client, root, world["acme"]["id"], gemini="AIza-test-gemini-2222")
    providers = client.get(f"{url}/providers", headers=ana).json()
    assert [p["id"] for p in providers] == ["openai", "gemini"] and providers[0]["model"]
    r = client.post(url, json=_body(acme), headers=ana)
    assert r.status_code == 422 and "pick a provider" in r.json()["detail"]

    _set_keys(client, root, world["acme"]["id"], openai=None, gemini="AIza-test-gemini-2222")
    r = client.post(url, json=_body(acme, provider="openai"), headers=ana)
    assert r.status_code == 409
    r = client.post(url, json=_body(acme), headers=ana)  # only Gemini: no need to pick
    assert r.status_code == 201 and r.json()["provider"] == "gemini"


def test_generate_review_and_accept(client, root, world, acme, monkeypatch):
    ana, deck = acme["auth"], acme["deck"]
    url = f"/api/decks/{deck['id']}/generation"
    existing = "A History question?"  # already in the deck (see the acme fixture)
    broken = {"question": "Broken?", "type": "multiple_choice", "difficulty": "easy", "options": ["a", "b"], "answer": "z"}

    def extra(prompt):
        if '"History"' in prompt and "medium" not in prompt and not getattr(extra, "done", False):
            extra.done = True  # type: ignore[attr-defined]
            return [{"question": existing, "type": "open", "difficulty": "easy", "options": [], "answer": "42"}, broken]
        return []

    fake = FakeLlm(extra=extra, short_by=2)
    monkeypatch.setattr(llm, "complete_json", fake)
    monkeypatch.setattr(generation.get_settings(), "generation_batch_size", 10)
    _set_keys(client, root, world["acme"]["id"])

    r = client.post(url, json=_body(acme, count=30, instructions="For kids, in Spanish"), headers=ana)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "running" and r.json()["batches_total"] == 4  # Science 6 cards: 1 call, History 24: 3 calls
    assert client.post(url, json=_body(acme), headers=ana).status_code == 409  # one generation at a time

    job = _wait(client, ana, deck["id"])
    assert job["status"] == "done", job
    cards = job["cards"]
    # GEN-2: exactly what was asked for, even though one reply came back short (topped up)
    assert len(cards) == 30
    science, history = acme["cats"]["Science"]["id"], acme["cats"]["History"]["id"]
    assert Counter(c["category_id"] for c in cards) == {science: 6, history: 24}
    assert Counter(c["difficulty"] for c in cards) == {1: 15, 3: 15}
    assert Counter(c["options"] is None for c in cards) == {True: 15, False: 15}
    assert job["batches_total"] == 5 and job["batches_done"] == 5  # + one top-up call
    # GEN-3 / GEN-4: the deck's question and the broken card were dropped
    assert existing not in [c["question"] for c in cards]
    assert job["dropped_duplicates"] == 1 and job["dropped_invalid"] == 1
    assert all(c["answer"] in c["options"] for c in cards if c["options"])
    # Prompts carry the instructions and list the deck's questions as already used
    assert all("For kids, in Spanish" in p for p in fake.prompts)
    assert any(existing in p for p in fake.prompts if '"History"' in p)
    assert all("A Science question?" not in p for p in fake.prompts if '"History"' in p)  # only the same category's
    # Later calls of a category list what the earlier ones wrote
    history_prompts = [p for p in fake.prompts if '"History"' in p]
    assert "Unique fact number" in history_prompts[-1]

    # Nothing is in the deck before accepting (GEN-6)
    assert client.get(f"/api/decks/{deck['id']}", headers=ana).json()["card_count"] == 5

    # Accept 3 cards, one edited, one a duplicate of a deck card
    chosen = [
        {**{k: cards[0][k] for k in ("category_id", "question", "options", "answer", "difficulty")}, "question": "Edited question?"},
        {k: cards[1][k] for k in ("category_id", "question", "options", "answer", "difficulty")},
        {"category_id": history, "question": "a history question", "options": None, "answer": "42", "difficulty": 1},
    ]
    r = client.post(f"{url}/accept", json={"job_id": job["id"] + 1, "cards": chosen}, headers=ana)
    assert r.status_code == 404
    r = client.post(f"{url}/accept", json={"job_id": job["id"], "cards": chosen}, headers=ana)
    assert r.status_code == 200, r.text
    assert r.json() == {"added": 2, "skipped_duplicates": ["a history question"]}
    detail = client.get(f"/api/decks/{deck['id']}", headers=ana).json()
    assert detail["card_count"] == 7 and detail["cards"][5]["question"] == "Edited question?"
    assert client.get(url, headers=ana).json() is None  # accepted: no open generation
    assert client.post(f"{url}/accept", json={"job_id": job["id"], "cards": chosen}, headers=ana).status_code == 404


def test_accept_validates_cards(client, root, world, acme, fake):
    ana, deck = acme["auth"], acme["deck"]
    url = f"/api/decks/{deck['id']}/generation"
    _set_keys(client, root, world["acme"]["id"])
    job = client.post(url, json=_body(acme, count=4), headers=ana).json()
    job = _wait(client, ana, deck["id"])
    bad = {"category_id": acme["cats"]["Art"]["id"], "question": "Q?", "options": ["a", "b"], "answer": "c", "difficulty": 1}
    assert client.post(f"{url}/accept", json={"job_id": job["id"], "cards": [bad]}, headers=ana).status_code == 422
    other = client.post("/api/categories", json={"organization_id": world["globex"]["id"], "name": "G", "color": "#000000"}, headers=root).json()
    foreign = {**bad, "category_id": other["id"], "answer": "a"}
    assert client.post(f"{url}/accept", json={"job_id": job["id"], "cards": [foreign]}, headers=ana).status_code == 404
    assert client.get(url, headers=ana).json()["status"] == "done"  # still open for review


def test_discard_while_running_stops_the_job(client, root, world, acme, monkeypatch):
    ana, deck = acme["auth"], acme["deck"]
    url = f"/api/decks/{deck['id']}/generation"
    release, called = threading.Event(), threading.Event()
    inner = FakeLlm()

    def slow(*args, **kwargs):
        called.set()
        release.wait(5)
        return inner(*args, **kwargs)

    monkeypatch.setattr(llm, "complete_json", slow)
    _set_keys(client, root, world["acme"]["id"])
    job = client.post(url, json=_body(acme, count=60), headers=ana).json()
    assert called.wait(5)
    r = client.post(f"{url}/accept", json={"job_id": job["id"], "cards": []}, headers=ana)
    assert r.status_code == 409 and "Still generating" in r.json()["detail"]
    assert client.delete(url, headers=ana).status_code == 204
    release.set()
    time.sleep(0.3)
    assert client.get(url, headers=ana).json() is None
    assert len(inner.prompts) <= 2  # the calls in flight finished; no new ones started
    assert client.delete(url, headers=ana).status_code == 404


def test_rejected_key_fails_the_job(client, root, world, acme, monkeypatch):
    ana, deck = acme["auth"], acme["deck"]

    def rejected(*args, **kwargs):
        raise llm.LlmError("OpenAI rejected the organization's API key (401): Incorrect API key", retryable=False)

    monkeypatch.setattr(llm, "complete_json", rejected)
    _set_keys(client, root, world["acme"]["id"])
    client.post(f"/api/decks/{deck['id']}/generation", json=_body(acme), headers=ana)
    job = _wait(client, ana, deck["id"])
    assert job["status"] == "failed" and "rejected the organization's API key" in job["error"] and job["cards"] == []
    # A failed generation can be discarded, and then another one started
    assert client.delete(f"/api/decks/{deck['id']}/generation", headers=ana).status_code == 204


def test_a_failed_batch_leaves_a_message(client, root, world, acme, monkeypatch):
    ana, deck = acme["auth"], acme["deck"]
    inner = FakeLlm()

    def flaky(provider, api_key, system, user, schema, attempts=3):
        if '"Science"' in user:
            raise llm.LlmError("OpenAI didn't answer within 180s")
        return inner(provider, api_key, system, user, schema)

    monkeypatch.setattr(llm, "complete_json", flaky)
    _set_keys(client, root, world["acme"]["id"])
    client.post(f"/api/decks/{deck['id']}/generation", json=_body(acme, count=10), headers=ana)
    job = _wait(client, ana, deck["id"])
    assert job["status"] == "done" and len(job["cards"]) == 8  # History's 8; Science's 2 never came
    assert any("Science: a batch of 2 failed" in m for m in job["messages"])
    assert any("Generated 8 of 10" in m for m in job["messages"])


def test_generation_is_scoped_to_the_organization(client, root, world, acme, fake):
    gus = client.post("/api/auth/login", json={"email": "gus@globex.dev", "password": "guspass123"}).json()["access_token"]
    gus_auth = {"Authorization": f"Bearer {gus}"}
    _set_keys(client, root, world["acme"]["id"])
    url = f"/api/decks/{acme['deck']['id']}/generation"
    assert client.get(url, headers=gus_auth).status_code == 404
    assert client.get(f"{url}/providers", headers=gus_auth).status_code == 404
    assert client.post(url, json=_body(acme), headers=gus_auth).status_code == 404
    # Ana's deck can't use another organization's categories
    other = client.post("/api/categories", json={"organization_id": world["globex"]["id"], "name": "G", "color": "#000000"}, headers=root).json()
    r = client.post(url, json={"count": 5, "categories": [{"category_id": other["id"]}]}, headers=acme["auth"])
    assert r.status_code == 404
    # Root can generate for any organization's deck
    assert client.post(url, json=_body(acme, count=2), headers=root).status_code == 201


def test_interrupted_jobs_are_failed_on_startup(client, root, world, acme, monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import create_app

    release = threading.Event()
    monkeypatch.setattr(llm, "complete_json", lambda *a, **k: release.wait(5) and {"cards": []})
    _set_keys(client, root, world["acme"]["id"])
    client.post(f"/api/decks/{acme['deck']['id']}/generation", json=_body(acme, count=2), headers=acme["auth"])
    with TestClient(create_app()) as restarted:  # a second startup, while the first job still runs
        job = restarted.get(f"/api/decks/{acme['deck']['id']}/generation", headers=acme["auth"]).json()
    release.set()
    assert job["status"] == "failed" and "restart" in job["error"]
