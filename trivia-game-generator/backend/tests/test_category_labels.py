"""Category labels (rules.md §2.2, CAT-1 … CAT-3, migration 0012): a long, precise name for the
organization and the LLM, a short label for players."""

from conftest import login
from test_generation import _body, _set_keys, _wait, fake  # noqa: F401  (fake is a fixture)
from test_library import publish
from test_multiplayer import connect, join, make_game, phase, until  # noqa: F401  (connect is a fixture)
from test_transfer import export, import_file


def test_label_is_optional_and_trimmed(client, acme):
    ana = acme["auth"]
    assert acme["cats"]["Science"]["label"] == ""
    r = client.post("/api/categories", json={"name": "History-Uruguay", "label": "  History ", "color": "#000000"}, headers=ana)
    assert r.status_code == 201 and r.json()["label"] == "History"
    cat = r.json()
    assert client.post("/api/categories", json={"name": "Long", "label": "x" * 41, "color": "#000000"}, headers=ana).status_code == 422

    # Labels needn't be unique in the organization: only names are (CAT-2)
    r = client.post("/api/categories", json={"name": "History-World", "label": "History", "color": "#111111"}, headers=ana)
    assert r.status_code == 201

    url = f"/api/categories/{cat['id']}"
    assert client.patch(url, json={"description": "Uruguay only"}, headers=ana).json()["label"] == "History"  # untouched
    assert client.patch(url, json={"label": "Historia"}, headers=ana).json()["label"] == "Historia"
    assert client.patch(url, json={"label": ""}, headers=ana).json()["label"] == ""  # cleared: shows the name


def _game_with(client, acme, labels: dict[str, str]) -> dict:
    ana = acme["auth"]
    for name, label in labels.items():
        client.patch(f"/api/categories/{acme['cats'][name]['id']}", json={"label": label}, headers=ana)
    game = make_game(client, acme)
    join(client, game, "Mia")
    return client.get(f"/api/games/{game['id']}", headers=ana).json()


def test_a_game_cant_show_the_same_label_twice(client, acme):
    ana = acme["auth"]
    game = _game_with(client, acme, {"Science": "Mixed", "Art": "mixed"})  # ignoring case
    assert game["setup_errors"] == ['CAT-3: slots A and C show the same label "Mixed" to players. Give their categories different labels.']
    assert client.post(f"/api/games/{game['id']}/start", headers=ana).status_code == 422

    # A label equal to another category's name clashes too: that's what players would see
    client.patch(f"/api/categories/{acme['cats']['Art']['id']}", json={"label": "history"}, headers=ana)
    game = client.get(f"/api/games/{game['id']}", headers=ana).json()
    assert [e[:20] for e in game["setup_errors"]] == ["CAT-3: slots B and C"]

    client.patch(f"/api/categories/{acme['cats']['Art']['id']}", json={"label": ""}, headers=ana)
    assert client.get(f"/api/games/{game['id']}", headers=ana).json()["setup_errors"] == []


def test_players_see_labels_and_the_snapshot_keeps_them(client, acme, connect):  # noqa: F811
    ana = acme["auth"]
    client.patch(f"/api/categories/{acme['cats']['History']['id']}", json={"name": "History-Uruguay", "label": "History"}, headers=ana)
    game = make_game(client, acme)
    mia = join(client, game, "Mia").json()
    r = client.post(f"/api/games/{game['id']}/start", headers=ana)
    assert r.status_code == 200, r.text
    history = next(c for c in r.json()["snapshot"]["deck"]["categories"] if c["name"] == "History-Uruguay")
    assert history["label"] == "History"

    # GAM-3: renaming the label afterwards doesn't reach the started game
    client.patch(f"/api/categories/{acme['cats']['History']['id']}", json={"label": "Something else"}, headers=ana)
    view = until(connect(game["id"], player_token=mia["player_token"]), phase("AWAIT_ROLL"))
    assert [c["name"] for c in view["state"]["board"]["categories"]] == ["Science", "History", "Art", "Pop"]


def test_labels_travel_in_files_and_library_copies(client, acme, world):
    ana = acme["auth"]
    gus = login(client, "gus@globex.dev", "guspass123")
    client.patch(f"/api/categories/{acme['cats']['History']['id']}", json={"name": "History-Uruguay", "label": "History"}, headers=ana)

    file = export(client, ana, "decks", acme["deck"]["id"]).json()
    by_name = {c["name"]: c for c in file["categories"]}
    assert by_name["History-Uruguay"]["label"] == "History"
    assert "label" not in by_name["Science"]  # left out when empty, like the example files

    r = import_file(client, gus, "decks", file)
    assert r.status_code == 201, r.text
    theirs = {c["name"]: c["label"] for c in client.get("/api/categories", headers=gus).json()}
    assert theirs["History-Uruguay"] == "History" and theirs["Science"] == ""

    backup = client.get(f"/api/organizations/{world['acme']['id']}/export", headers=ana).json()
    assert next(c for c in backup["categories"] if c["name"] == "History-Uruguay")["label"] == "History"

    # The Library: copies keep the label, and search finds it (SHR-2, SHR-5)
    cat = client.post("/api/categories", json={"name": "Geography-Uruguay", "label": "Geography", "color": "#123456"}, headers=ana).json()
    publish(client, ana, "categories", cat["id"])
    found = client.get("/api/library/categories", params={"q": "geograph"}, headers=gus).json()
    assert [c["label"] for c in found] == ["Geography"]
    assert client.get("/api/library/categories", params={"q": "Uruguay"}, headers=gus).json()  # name still searchable
    copied = client.post(f"/api/library/categories/{cat['id']}/copy", json={}, headers=gus).json()
    assert copied["label"] == "Geography"

    publish(client, ana, "decks", acme["deck"]["id"])
    shown = client.get(f"/api/library/decks/{acme['deck']['id']}", headers=gus).json()
    assert {c["name"]: c["label"] for c in shown["categories"]}["History-Uruguay"] == "History"


def test_prompts_tell_the_model_what_players_see(client, root, world, acme, fake):  # noqa: F811
    ana, cats = acme["auth"], acme["cats"]
    client.patch(f"/api/categories/{cats['History']['id']}", json={"name": "History-Uruguay", "label": "History", "description": "Uruguay only"}, headers=ana)
    _set_keys(client, root, world["acme"]["id"])
    client.post(f"/api/decks/{acme['deck']['id']}/generation", json=_body(acme, count=10), headers=ana)
    _wait(client, ana, acme["deck"]["id"])
    history = next(p for p in fake.prompts if p.split("\n")[1].startswith('Category: "History-Uruguay"'))
    assert 'Category: "History-Uruguay" (players see it as "History"): Uruguay only' in history
    science = next(p for p in fake.prompts if p.split("\n")[1].startswith('Category: "Science"'))
    assert '- "History-Uruguay" (players see it as "History"): Uruguay only' in science
    assert "players see it as" not in science.split("\n")[1]  # no label: nothing to add
