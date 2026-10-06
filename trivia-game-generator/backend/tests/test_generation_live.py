"""Real OpenAI / Gemini calls. Skipped unless RUN_LIVE_LLM=1; the keys come from OPENAI_API_KEY and
GEMINI_API_KEY (environment or the repo-root .env). The app itself never reads those variables:
it only uses the keys stored on each organization. These tests copy them onto a test organization.

    RUN_LIVE_LLM=1 uv run pytest tests/test_generation_live.py -v -s
"""

import os
import time
from collections import Counter

import pytest
from dotenv import dotenv_values

from app.config import ROOT_ENV_FILE

_env = {**dotenv_values(ROOT_ENV_FILE), **os.environ}
pytestmark = pytest.mark.skipif(os.environ.get("RUN_LIVE_LLM") != "1", reason="set RUN_LIVE_LLM=1 to call the real LLMs")


@pytest.mark.parametrize("provider", ["openai", "gemini"])
def test_live_generation(client, root, world, acme, provider):
    key = _env.get(f"{provider.upper()}_API_KEY")
    if not key:
        pytest.skip(f"{provider.upper()}_API_KEY is not set")
    r = client.patch(f"/api/organizations/{world['acme']['id']}", json={f"{provider}_api_key": key}, headers=root)
    assert r.status_code == 200
    ana, deck = acme["auth"], acme["deck"]
    cats = acme["cats"]
    body = {
        "count": 24,
        "categories": [{"category_id": cats["Science"]["id"], "weight": 25}, {"category_id": cats["History"]["id"], "weight": 75}],
        "difficulty": {"easy": 1, "medium": 1, "hard": 1},
        "types": {"multiple_choice": 1, "open": 1},
    }
    started = time.monotonic()
    r = client.post(f"/api/decks/{deck['id']}/generation", json=body, headers=ana)
    assert r.status_code == 201, r.text
    while (job := client.get(f"/api/decks/{deck['id']}/generation", headers=ana).json())["status"] == "running":
        assert time.monotonic() - started < 300
        time.sleep(1)
    print(f"\n{provider} {job['model']}: {len(job['cards'])} cards in {time.monotonic() - started:.1f}s, "
          f"{job['batches_done']} calls, dropped {job['dropped_duplicates']} duplicates / {job['dropped_invalid']} invalid, messages {job['messages']}")
    for c in job["cards"][:6]:
        print(" ", c["difficulty"], c["question"], "→", c["answer"], c["options"] or "")
    assert job["status"] == "done", job
    assert len(job["cards"]) >= 22  # a stray duplicate may be dropped and not replaced
    assert Counter(c["category_id"] for c in job["cards"])[cats["History"]["id"]] >= 16
    assert len({c["question"].lower() for c in job["cards"]}) == len(job["cards"])
