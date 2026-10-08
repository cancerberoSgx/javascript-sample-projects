"""UI translations (rules.md §2.9, I18N-*): the catalog sync, the public messages, root's
translation management, AI translation, files, language choices, and translatable errors."""

import json

import pytest
from test_multiplayer import (  # noqa: F401  (connect is a fixture)
    connect,
    make_game,
    until,
)

from app import db, i18n, llm
from app.i18n import icu
from app.models import CatalogKey
from app.repositories import translations

ES_COUNT = len(json.loads((i18n.BUNDLED_DIR / "es.json").read_text())["messages"])


def test_catalog_and_bundled_spanish_are_loaded(client, root):
    keys = client.get("/api/translations/keys", headers=root).json()
    assert len(keys) == len(i18n.catalog())
    roll = next(k for k in keys if k["key"] == "play.rollDice")
    assert roll["source"] == "Roll the dice" and roll["area"] == "play" and roll["description"] and roll["max_length"] == 18

    assert client.get("/api/i18n/languages").json() == [
        {"code": "en", "name": "English", "native_name": "English"},
        {"code": "es", "name": "Spanish", "native_name": "Español"},
    ]
    r = client.get("/api/i18n/messages/es")  # public: the player page works logged out
    assert r.status_code == 200
    body = r.json()
    assert body["messages"]["play.rollDice"] == "Tirar el dado"
    assert len(body["messages"]) == ES_COUNT
    # Unchanged since: the browser keeps its copy
    assert client.get("/api/i18n/messages/es", headers={"If-None-Match": r.headers["ETag"]}).status_code == 304
    assert client.get("/api/i18n/messages/en").json()["messages"] == {}  # English comes with the code
    assert client.get("/api/i18n/messages/xx").status_code == 404

    stats = {s["code"]: s for s in client.get("/api/translations/languages", headers=root).json()}
    assert stats["es"]["translated"] == ES_COUNT and stats["es"]["missing"] == 0 and stats["es"]["outdated"] == 0
    assert stats["en"]["missing"] == 0


def _resync(monkeypatch, catalog: dict[str, CatalogKey], bundled: dict[str, dict[str, str]] | None = None):
    monkeypatch.setattr(i18n, "catalog", lambda: catalog)
    if bundled is not None:
        monkeypatch.setattr(i18n, "bundled", lambda: bundled)
    with db.connection() as conn:
        i18n.sync(conn)


def test_sync_updates_keys_marks_outdated_and_obsolete(client, root, monkeypatch):
    original = dict(i18n.catalog())
    catalog = dict(original)
    # The English text changes, a key is dropped, another is new (with a bundled translation)
    changed = catalog["play.rollDice"].model_copy(update={"source": "Roll!", "source_hash": i18n.source_hash("Roll!")})
    catalog["play.rollDice"] = changed
    del catalog["play.rollAgain"]
    catalog["play.brandNew"] = CatalogKey(key="play.brandNew", area="play", source="New {name}", source_hash=i18n.source_hash("New {name}"), description="x", placeholders={"name": "n"}, max_length=None)
    _resync(monkeypatch, catalog, {"es": {"play.brandNew": "Nuevo {name}", "play.rollDice": "¡Tira!"}})

    keys = {k["key"]: k for k in client.get("/api/translations/keys", headers=root).json()}
    assert keys["play.rollAgain"]["obsolete"] and not keys["play.rollDice"]["obsolete"]
    es = {t["key"]: t for t in client.get("/api/translations/es", headers=root).json()}
    assert es["play.rollDice"]["outdated"] and es["play.rollDice"]["message"] == "Tirar el dado"  # bundled never overwrites
    assert es["play.brandNew"]["message"] == "Nuevo {name}" and es["play.brandNew"]["status"] == "reviewed"
    messages = client.get("/api/i18n/messages/es").json()["messages"]
    assert "play.rollAgain" not in messages  # obsolete keys aren't sent

    # A key that comes back is in use again, with its translation
    _resync(monkeypatch, original, {})
    keys = {k["key"]: k for k in client.get("/api/translations/keys", headers=root).json()}
    assert not keys["play.rollAgain"]["obsolete"]
    # Saving a translation makes it current again
    r = client.put("/api/translations/es/play.rollDice", json={"message": "Tirar el dado"}, headers=root)
    assert r.json()["outdated"] is False


def test_bundled_translations_never_return_after_a_delete(client, root, monkeypatch):
    assert client.delete("/api/translations/es/play.rollDice", headers=root).status_code == 204
    _resync(monkeypatch, dict(i18n.catalog()))  # a restart: the key isn't new, so nothing is added back
    assert "play.rollDice" not in client.get("/api/i18n/messages/es").json()["messages"]


def test_only_root_manages_translations(client, world):
    ana = world["ana_auth"]
    for method, path in [
        ("get", "/api/translations/keys"),
        ("get", "/api/translations/languages"),
        ("get", "/api/translations/es"),
        ("put", "/api/translations/es/play.rollDice"),
        ("post", "/api/translations/languages"),
        ("get", "/api/translations/es/export"),
    ]:
        r = getattr(client, method)(path, headers=ana, **({"json": {"message": "x"}} if method in ("put", "post") else {}))
        assert r.status_code in (403, 422), (path, r.status_code)
        if r.status_code == 422:  # body validation runs first; with a valid body it's 403
            assert method == "post"
    assert client.get("/api/translations/keys").status_code == 401


def test_saving_checks_the_message(client, root):
    def save(message: str, key="lobby.youreIn"):
        return client.put(f"/api/translations/es/{key}", json={"message": message}, headers=root)

    r = save("¡Hola, {nombre}!")
    assert r.status_code == 422 and "Unknown placeholder {nombre}" in r.json()["detail"][0]
    r = save("{count, plural, one {x}}", key="lobby.players")
    assert r.status_code == 422 and "other" in r.json()["detail"][0]
    assert save("<i>{name}</i>").status_code == 422  # a tag the English text doesn't have

    r = save("¡Hola!")  # leaving a placeholder out is allowed, with a warning
    assert r.status_code == 200
    assert r.json()["warnings"] == ["Leaves out {name}"] and r.json()["status"] == "reviewed" and r.json()["updated_by_name"] == "Root"
    assert client.get("/api/i18n/messages/es").json()["messages"]["lobby.youreIn"] == "¡Hola!"
    assert save("x", key="no.such").status_code == 404

    # English is the code's: not editable here
    assert client.put("/api/translations/en/lobby.youreIn", json={"message": "x"}, headers=root).status_code == 409
    assert client.get("/api/translations/en", headers=root).status_code == 409


def test_languages(client, root, world):
    r = client.post("/api/translations/languages", json={"code": "pt-BR", "name": "Portuguese (Brazil)", "native_name": "Português"}, headers=root)
    assert r.status_code == 201 and r.json()["missing"] == len(i18n.catalog()) and r.json()["translated"] == 0
    assert client.post("/api/translations/languages", json={"code": "pt-BR", "name": "x", "native_name": "x"}, headers=root).status_code == 409
    assert client.post("/api/translations/languages", json={"code": "Portuguese", "name": "x", "native_name": "x"}, headers=root).status_code == 422

    # An organization and a user pick it; disabling hides it from the public list
    acme = world["acme"]["id"]
    assert client.patch(f"/api/organizations/{acme}", json={"language": "pt-BR"}, headers=root).json()["language"] == "pt-BR"
    client.patch("/api/translations/languages/pt-BR", json={"enabled": False}, headers=root)
    assert [lang["code"] for lang in client.get("/api/i18n/languages").json()] == ["en", "es"]
    assert client.get("/api/i18n/messages/pt-BR").status_code == 404
    assert client.patch(f"/api/organizations/{acme}", json={"language": "pt-BR"}, headers=root).status_code == 422

    # Deleting it: the organization goes back to English
    assert client.delete("/api/translations/languages/pt-BR", headers=root).status_code == 204
    assert client.get(f"/api/organizations/{acme}", headers=root).json()["language"] == "en"
    assert client.delete("/api/translations/languages/en", headers=root).status_code == 409
    assert client.patch("/api/translations/languages/en", json={"enabled": False}, headers=root).status_code == 409


def test_language_choices_of_users_organizations_and_games(client, root, world, acme, connect):  # noqa: F811
    ana = acme["auth"]
    me = client.get("/api/auth/me", headers=ana).json()
    assert me["language"] is None and me["organization_language"] == "en"
    # Members choose their own language and their organization's (not other settings)
    assert client.patch(f"/api/users/{me['id']}", json={"language": "es"}, headers=ana).json()["language"] == "es"
    assert client.patch(f"/api/users/{me['id']}", json={"language": None}, headers=ana).json()["language"] is None
    assert client.patch(f"/api/users/{me['id']}", json={"language": "xx"}, headers=ana).status_code == 422
    org = world["acme"]["id"]
    assert client.patch(f"/api/organizations/{org}", json={"language": "es"}, headers=ana).json()["language"] == "es"
    assert client.get("/api/auth/me", headers=ana).json()["organization_language"] == "es"

    # A game uses its organization's language unless it picks one; players get it live
    game = make_game(client, acme)
    assert game["language"] is None and game["organization_language"] == "es"
    ws = connect(game["id"], code=game["join_code"])
    assert until(ws, lambda m: m["type"] == "game")["game"]["language"] == "es"
    assert client.patch(f"/api/games/{game['id']}", json={"language": "en"}, headers=ana).json()["language"] == "en"
    assert until(ws, lambda m: m["type"] == "game" and m["game"]["language"] == "en")


def test_ai_translation(client, root, world, monkeypatch):
    acme = world["acme"]["id"]
    keys = ["lobby.youreIn", "lobby.players", "play.rollDice"]
    body = {"organization_id": acme, "provider": None, "keys": keys}
    r = client.post("/api/translations/es/ai", json=body, headers=root)
    assert r.status_code == 409 and "no OpenAI or Gemini API key" in r.json()["detail"]
    client.patch(f"/api/organizations/{acme}", json={"openai_api_key": "sk-test-key-123456"}, headers=root)

    prompts = []

    def fake(provider, model, api_key, system, user, schema):
        prompts.append((provider, api_key, system, user))
        return {
            "translations": [
                {"key": "lobby.youreIn", "message": "¡Adentro, {name}!"},
                {"key": "lobby.players", "message": "Jugadores · {cantidad}"},  # a renamed placeholder: rejected
                {"key": "other.key", "message": "ignored"},
            ]
        }

    monkeypatch.setattr(llm, "complete_json", fake)
    r = client.post("/api/translations/es/ai", json=body, headers=root)
    assert r.status_code == 200, r.text
    out = r.json()
    assert [t["key"] for t in out["translated"]] == ["lobby.youreIn"] and out["translated"][0]["status"] == "machine"
    assert {f["key"]: f["reason"] for f in out["failed"]} == {
        "lobby.players": "Unknown placeholder {cantidad}",
        "play.rollDice": "The model didn't return this key",
    }
    provider, api_key, system, user = prompts[0]
    assert provider == "openai" and api_key == "sk-test-key-123456"
    assert "Spanish" in system and "ICU MessageFormat" in system
    assert "A player's name" in user  # the placeholder's description
    assert '"previous_translation": "¡Ya estás dentro, {name}!"' in user  # what it replaces
    stats = {s["code"]: s for s in client.get("/api/translations/languages", headers=root).json()}
    assert stats["es"]["machine"] == 1
    # Reviewing it (saving as is) makes it a person's translation
    r = client.put("/api/translations/es/lobby.youreIn", json={"message": "¡Adentro, {name}!"}, headers=root)
    assert r.json()["status"] == "reviewed"

    assert client.post("/api/translations/es/ai", json={**body, "keys": ["no.such"]}, headers=root).status_code == 404

    def broken(*_args, **_kwargs):
        raise llm.LlmError("OpenAI rejected the organization's API key (401)", retryable=False)

    monkeypatch.setattr(llm, "complete_json", broken)
    assert client.post("/api/translations/es/ai", json=body, headers=root).status_code == 502


def test_export_and_import(client, root):
    file = client.get("/api/translations/es/export", headers=root).json()
    assert file["format"] == "trivia-translations" and file["language"] == "es" and file["native_name"] == "Español"
    entry = next(e for e in file["entries"] if e["key"] == "lobby.youreIn")
    assert entry["english"] == "You're in, {name}!" and entry["translation"] == "¡Ya estás dentro, {name}!" and entry["placeholders"]

    # Unchanged entries are counted, changed ones saved
    entry["translation"] = "¡Bienvenido, {name}!"
    r = client.post("/api/translations/es/import", json=file, headers=root)
    assert r.json() == {"imported": 1, "unchanged": ES_COUNT - 1}
    assert client.get("/api/i18n/messages/es").json()["messages"]["lobby.youreIn"] == "¡Bienvenido, {name}!"

    # All or nothing, with every problem listed
    entry["translation"] = "Hola {otro}"
    file["entries"].append({"key": "no.such", "translation": "x"})
    r = client.post("/api/translations/es/import", json=file, headers=root)
    assert r.status_code == 422 and r.json()["detail"] == ["lobby.youreIn: Unknown placeholder {otro}", "no.such: unknown key"]
    assert client.post("/api/translations/en/import", json={**file, "language": "en"}, headers=root).status_code == 409
    assert client.post("/api/translations/es/import", json={**file, "language": "fr"}, headers=root).status_code == 422


def test_player_errors_carry_a_catalog_key(client, acme):
    game = make_game(client, acme)
    assert client.post(f"/api/games/{game['id']}/join", json={"code": game["join_code"], "name": "Zoe"}).status_code == 201
    r = client.post(f"/api/games/{game['id']}/join", json={"code": game["join_code"], "name": "Zoe"})
    assert r.status_code == 409 and r.json()["code"] == "error.nameTaken" and r.json()["params"] == {}
    assert "already taken" in r.json()["detail"]
    r = client.post(f"/api/games/{game['id']}/join", json={"code": "nope", "name": "Max"})
    assert r.status_code == 404 and r.json()["code"] == "error.badLink"
    # Admin errors stay plain
    r = client.get("/api/games/999999", headers=acme["auth"])
    assert r.status_code == 404 and "code" not in r.json()


def test_engine_errors_have_keys(client, acme, connect):  # noqa: F811
    game = make_game(client, acme)
    token = client.post(f"/api/games/{game['id']}/join", json={"code": game["join_code"], "name": "Zoe"}).json()["player_token"]
    client.post(f"/api/games/{game['id']}/start", headers=acme["auth"])
    ws = connect(game["id"], player_token=token)
    until(ws, lambda m: m["type"] == "game" and m["state"])
    ws.send_json({"type": "action", "action": {"type": "MOVE", "to": 3}})
    err = until(ws, lambda m: m["type"] == "error")
    assert err["code"] == "engine.wrongPhase" and err["params"] == {"action": "MOVE", "phase": "AWAIT_ROLL"}
    ws.send_json({"type": "action", "action": {"type": "ROLL"}})
    state = until(ws, lambda m: m["type"] == "game" and m["state"]["phase"] == "AWAIT_MOVE")["state"]
    last = state["log"][-1]
    assert last["key"] == "log.rolled" and last["params"]["value"] == 1 and last["params"]["rigged"] == "no"
    assert last["text"].startswith("rolled a 1")


@pytest.mark.parametrize(
    ("message", "args", "tags"),
    [
        ("Hello", set(), set()),
        ("It's {name}'s turn", {"name"}, set()),
        ("'{literal}' {real}", {"real"}, set()),
        ("<b>{n, number}</b> and {d, date, short}", {"n", "d"}, {"b"}),
        ("{n, plural, offset:1 =0 {none} one {# <b>x</b>} other {{who} and #}}", {"n", "who"}, {"b"}),
        ("{g, select, female {ella} other {él}}", {"g"}, set()),
    ],
)
def test_icu_shapes(message, args, tags):
    shape = icu.parse(message)
    assert shape.args == args and shape.tags == tags


@pytest.mark.parametrize("message", ["{", "}", "{a", "{a, plural, one {x}}", "{a, nope}", "<b>x", "x</b>", "{a, select, x {1} x {2} other {3}}", "{, number}"])
def test_icu_rejects(message):
    with pytest.raises(icu.IcuError):
        icu.parse(message)


def test_repository_messages_skip_obsolete(client, root):
    with db.connection() as conn:
        assert {m.key for m in translations.messages(conn, "es")} <= set(i18n.catalog())
