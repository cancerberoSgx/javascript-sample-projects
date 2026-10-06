"""Background images (rules.md §2.1.2, BKG-*): the image library, the /media files, board and
game backgrounds, and the snapshot taken at start."""

import io

import pytest
from conftest import board_definition
from PIL import Image

from app import images as processing
from app.config import get_settings
from app.storage import get_store


def png(width: int = 40, height: int = 30, color=(200, 40, 40), mode: str = "RGB") -> bytes:
    out = io.BytesIO()
    Image.new(mode, (width, height), color).save(out, format="PNG")
    return out.getvalue()


def upload(client, auth, data: bytes, filename: str = "pic.png", **form):
    return client.post("/api/images", files={"file": (filename, data, "image/png")}, data=form, headers=auth)


def stored(client, url: str) -> Image.Image:
    r = client.get(url)
    assert r.status_code == 200
    return Image.open(io.BytesIO(r.content))


def start_game(client, acme, board_id: int, background=None) -> dict:
    ana = acme["auth"]
    game = client.post(
        "/api/games", json={"name": "G", "board_id": board_id, "deck_id": acme["deck"]["id"], "categories": acme["mapping"]}, headers=ana
    ).json()
    if background is not None:
        r = client.patch(f"/api/games/{game['id']}", json={"background": background}, headers=ana)
        assert r.status_code == 200, r.text
    client.post(f"/api/games/{game['id']}/players", json={"name": "Pat"}, headers=ana)
    r = client.post(f"/api/games/{game['id']}/start", headers=ana)
    assert r.status_code == 200, r.text
    return r.json()


def board_with(client, auth, background: dict | None, name: str = "Pretty"):
    definition = board_definition("linear-basic") | ({"background": background} if background is not None else {})
    return client.post("/api/boards", json={"name": name, "definition": definition}, headers=auth)


# ---------- upload and storage (BKG-3, BKG-8) ----------


def test_upload_reencodes_to_webp_and_serves_an_immutable_file(client, world):
    ana = world["ana_auth"]
    r = upload(client, ana, png(), name="Red square")
    assert r.status_code == 201, r.text
    img = r.json()
    assert img["key"].endswith(".webp") and len(img["key"]) == 64 + 5
    assert img["url"] == f"/media/{img['key']}"
    assert (img["name"], img["width"], img["height"], img["content_type"]) == ("Red square", 40, 30, "image/webp")
    assert img["organization_id"] == world["acme"]["id"] and img["creator_name"] == "Ana"

    # Served without logging in, cached forever
    r = client.get(img["url"])
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/webp"
    assert r.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert len(r.content) == img["bytes"]
    assert client.get("/media/" + "0" * 64 + ".webp").status_code == 404

    # Same file again: the same library entry
    again = upload(client, ana, png(), filename="copy.png")
    assert again.json()["id"] == img["id"]
    assert [i["id"] for i in client.get("/api/images", headers=ana).json()] == [img["id"]]


def test_large_images_are_scaled_down_and_lose_their_metadata(client, world):
    exif = Image.Exif()
    exif[0x010F] = "SpyCam"  # Make
    exif[0x0112] = 6  # Orientation: rotated 90° (the stored image is turned upright)
    raw = io.BytesIO()
    Image.new("RGB", (4000, 1000), (10, 120, 200)).save(raw, format="JPEG", exif=exif)
    r = upload(client, world["ana_auth"], raw.getvalue(), filename="photo.jpg")
    assert r.status_code == 201, r.text
    assert (r.json()["width"], r.json()["height"]) == (750, 3000)  # upright, long side 3000
    out = stored(client, r.json()["url"])
    assert out.format == "WEBP" and out.size == (750, 3000)
    assert not out.getexif() and "exif" not in out.info


def test_transparency_is_kept(client, world):
    r = upload(client, world["ana_auth"], png(color=(0, 0, 0, 0), mode="RGBA"))
    assert r.status_code == 201
    assert stored(client, r.json()["url"]).mode == "RGBA"


@pytest.mark.parametrize(
    "data, message",
    [
        (b"hello, not an image", "isn't an image"),
        (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "isn't an image"),
        (b"", "empty"),
        (png()[:60], "damaged"),
    ],
)
def test_rejects_what_isnt_a_usable_image(client, world, data, message):
    r = upload(client, world["ana_auth"], data)
    assert r.status_code == 422
    assert message in r.json()["detail"][0]


def test_rejects_too_many_pixels_and_too_many_bytes(client, world, monkeypatch):
    monkeypatch.setattr(get_settings(), "image_max_megapixels", 0.001)  # 1000 pixels
    r = upload(client, world["ana_auth"], png(50, 50))
    assert r.status_code == 422 and "megapixels" in r.json()["detail"][0]
    monkeypatch.setattr(get_settings(), "image_max_megapixels", 40)
    monkeypatch.setattr(get_settings(), "image_max_upload_mb", 0.0001)  # ~100 bytes
    r = upload(client, world["ana_auth"], png(50, 50))
    assert r.status_code in (413, 422)


# ---------- library access ----------


def test_libraries_are_per_organization(client, world, root):
    ana = world["ana_auth"]
    img = upload(client, ana, png()).json()
    gus = client.post("/api/auth/login", json={"email": "gus@globex.dev", "password": "guspass123"}).json()["access_token"]
    gus = {"Authorization": f"Bearer {gus}"}

    assert client.get("/api/images", headers=gus).json() == []
    assert client.get(f"/api/images/{img['id']}", headers=gus).status_code == 404
    assert client.patch(f"/api/images/{img['id']}", json={"name": "x"}, headers=gus).status_code == 404
    assert client.delete(f"/api/images/{img['id']}", headers=gus).status_code == 404
    # Members upload into their own organization only
    assert upload(client, gus, png(), organization_id=str(world["acme"]["id"])).status_code == 403
    # Root sees any organization's library
    assert [i["id"] for i in client.get(f"/api/images?organization_id={world['acme']['id']}", headers=root).json()] == [img["id"]]

    r = client.patch(f"/api/images/{img['id']}", json={"name": "  Sunset  "}, headers=ana)
    assert r.json()["name"] == "Sunset"


def test_same_file_in_two_organizations_is_stored_once(client, world, root):
    ana = world["ana_auth"]
    a = upload(client, ana, png()).json()
    g = upload(client, root, png(), organization_id=str(world["globex"]["id"])).json()
    assert a["id"] != g["id"] and a["key"] == g["key"]

    assert client.delete(f"/api/images/{a['id']}", headers=ana).status_code == 204
    assert get_store().exists(g["key"])  # Globex still has it
    assert client.get(g["url"]).status_code == 200
    assert client.delete(f"/api/images/{g['id']}", headers=root).status_code == 204
    assert not get_store().exists(g["key"])
    assert client.get(g["url"]).status_code == 404


# ---------- import from a URL (BKG-3) ----------


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost:8000/media/x.png",
        "http://127.0.0.1/a.png",
        "http://10.1.2.3/a.png",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/a.png",
        "file:///etc/passwd",
        "ftp://example.com/a.png",
        "http://user:pw@example.com/a.png",
    ],
)
def test_import_refuses_private_and_odd_addresses(client, world, url):
    r = client.post("/api/images/import", json={"url": url}, headers=world["ana_auth"])
    assert r.status_code == 422, r.text


def test_import_keeps_a_copy(client, world, monkeypatch):
    fetched = []
    monkeypatch.setattr(processing, "fetch_url", lambda url: fetched.append(url) or png(64, 64, (0, 200, 0)))
    r = client.post("/api/images/import", json={"url": "https://pics.example.com/a/forest.jpg?size=big"}, headers=world["ana_auth"])
    assert r.status_code == 201, r.text
    img = r.json()
    assert fetched == ["https://pics.example.com/a/forest.jpg?size=big"]
    assert (img["name"], img["source_url"], img["width"]) == ("forest.jpg", "https://pics.example.com/a/forest.jpg?size=big", 64)
    assert client.get(img["url"]).status_code == 200


def test_import_reports_download_problems(client, world, monkeypatch):
    def fail(url):
        raise processing.ImageError("The address answered with HTTP 404.")

    monkeypatch.setattr(processing, "fetch_url", fail)
    r = client.post("/api/images/import", json={"url": "https://example.com/missing.png"}, headers=world["ana_auth"])
    assert r.status_code == 422 and r.json()["detail"] == ["The address answered with HTTP 404."]


# ---------- board and game backgrounds (BKG-2, BKG-4…7) ----------


def test_board_background_must_be_in_the_library(client, acme, world, root):
    ana = acme["auth"]
    img = upload(client, ana, png()).json()
    background = {"image": img["key"], "fit": "tile", "tile_size": 0.2, "fade": 0.3, "crop": {"x": 0.1, "y": 0, "w": 0.5, "h": 1}}

    r = board_with(client, ana, background)
    assert r.status_code == 201, r.text
    assert r.json()["definition"]["background"] == background  # stored as given, nothing added

    # Another organization's image (even the same file under another key) or an unknown key
    other = upload(client, root, png(10, 10), organization_id=str(world["globex"]["id"])).json()
    r = board_with(client, ana, {"image": other["key"]}, name="Other")
    assert r.status_code == 422 and "BKG-4" in r.json()["detail"][0]
    r = client.patch(f"/api/boards/{acme['board']['id']}", json={"definition": board_definition("linear-basic") | {"background": {"image": "f" * 64 + ".webp"}}}, headers=ana)
    assert r.status_code == 422

    # Shape checks (rules.md §2.1.2)
    for bad in ({"fit": "zoom"}, {"opacity": 2}, {"crop": {"x": 0.6, "y": 0, "w": 0.5, "h": 1}}, {"color": "red"}, {"image": "../etc/passwd"}, {"position": {"x": 2, "y": 0}}, {"sparkle": True}):
        assert board_with(client, ana, bad, name="Bad").status_code == 422, bad

    # A board without a background has no "background" key at all
    assert "background" not in acme["board"]["definition"]


def test_image_in_use_cant_be_deleted(client, acme):
    ana = acme["auth"]
    img = upload(client, ana, png()).json()
    board = board_with(client, ana, {"image": img["key"]}).json()
    assert client.get(f"/api/images/{img['id']}", headers=ana).json()["board_count"] == 1
    r = client.delete(f"/api/images/{img['id']}", headers=ana)
    assert r.status_code == 409 and 'board "Pretty"' in r.json()["detail"]

    # Removing the background frees it
    definition = {k: v for k, v in board["definition"].items() if k != "background"}
    assert client.patch(f"/api/boards/{board['id']}", json={"definition": definition}, headers=ana).status_code == 200
    assert client.get(f"/api/images/{img['id']}", headers=ana).json()["board_count"] == 0
    assert client.delete(f"/api/images/{img['id']}", headers=ana).status_code == 204
    assert not get_store().exists(img["key"])


def test_games_use_the_board_background_or_their_own(client, acme):
    ana = acme["auth"]
    lake = upload(client, ana, png(color=(0, 0, 255))).json()
    fire = upload(client, ana, png(color=(255, 0, 0))).json()
    board = board_with(client, ana, {"image": lake["key"], "fit": "contain"}).json()

    # null (the default): the board's background is copied into the snapshot (BKG-6)
    plain = start_game(client, acme, board["id"])
    assert plain["background"] is None
    assert plain["snapshot"]["board"]["background"] == {"image": lake["key"], "fit": "contain"}

    # Its own background replaces the board's
    game = start_game(client, acme, board["id"], {"image": fire["key"], "fit": "stretch", "opacity": 0.5})
    assert game["background"] == {"image": fire["key"], "fit": "stretch", "opacity": 0.5}
    assert game["snapshot"]["board"]["background"] == game["background"]

    # A background without an image = no image, even though the board has one (BKG-5)
    game = start_game(client, acme, board["id"], {})
    assert "background" not in game["snapshot"]["board"]
    game = start_game(client, acme, board["id"], {"color": "#112233"})
    assert game["snapshot"]["board"]["background"] == {"color": "#112233"}

    # Started games can't change it, and their snapshot keeps the image in use (BKG-7)
    r = client.patch(f"/api/games/{game['id']}", json={"background": None}, headers=ana)
    assert r.status_code == 409
    board_def = {k: v for k, v in board["definition"].items() if k != "background"}
    client.patch(f"/api/boards/{board['id']}", json={"definition": board_def}, headers=ana)
    assert client.get(f"/api/games/{plain['id']}", headers=ana).json()["snapshot"]["board"]["background"]["image"] == lake["key"]
    r = client.delete(f"/api/images/{lake['id']}", headers=ana)
    assert r.status_code == 409 and 'game "G"' in r.json()["detail"]
    fire_out = client.get(f"/api/images/{fire['id']}", headers=ana).json()
    assert (fire_out["board_count"], fire_out["game_count"]) == (0, 1)


def test_awaiting_game_background_can_change_and_clear(client, acme, world, root):
    ana = acme["auth"]
    img = upload(client, ana, png()).json()
    game = client.post("/api/games", json={"name": "Lobby"}, headers=ana).json()
    r = client.patch(f"/api/games/{game['id']}", json={"background": {"image": img["key"], "zoom": 2}}, headers=ana)
    assert r.json()["background"] == {"image": img["key"], "zoom": 2}
    assert client.get("/api/games", headers=ana).json()[0]["background"] == {"image": img["key"], "zoom": 2}
    # Leaving it out of a PATCH keeps it; null resets to the board's
    assert client.patch(f"/api/games/{game['id']}", json={"name": "Renamed"}, headers=ana).json()["background"] == {"image": img["key"], "zoom": 2}
    assert client.patch(f"/api/games/{game['id']}", json={"background": None}, headers=ana).json()["background"] is None
    # Not someone else's image
    other = upload(client, root, png(9, 9), organization_id=str(world["globex"]["id"])).json()
    assert client.patch(f"/api/games/{game['id']}", json={"background": {"image": other["key"]}}, headers=ana).status_code == 422


def test_live_view_carries_the_snapshot_background(client, acme):
    ana = acme["auth"]
    img = upload(client, ana, png()).json()
    board = board_with(client, ana, {"image": img["key"], "blur": 2}).json()
    game = start_game(client, acme, board["id"])
    with client.websocket_connect(f"/api/games/{game['id']}/ws") as ws:
        ws.send_json({"type": "hello", "code": game["join_code"]})
        msg = ws.receive_json()
    assert msg["game"]["background"] == {"image": img["key"], "blur": 2}


def test_deleting_an_organization_removes_files_only_it_had(client, world, root):
    globex = world["globex"]["id"]
    only = upload(client, root, png(11, 11), organization_id=str(globex)).json()
    shared = upload(client, root, png(12, 12), organization_id=str(globex)).json()
    upload(client, world["ana_auth"], png(12, 12))
    gus = next(u for u in client.get(f"/api/users?organization_id={globex}", headers=root).json() if u["name"] == "Gus")
    assert client.delete(f"/api/users/{gus['id']}", headers=root).status_code == 204
    assert client.delete(f"/api/organizations/{globex}", headers=root).status_code == 204
    assert not get_store().exists(only["key"])
    assert get_store().exists(shared["key"])
