# pyegui extensions (local fork)

This folder is a vendored copy of [pyegui](https://github.com/GachiLord/pyegui) 0.5.0
(upstream commit `8b11fd4`, MIT, see `LICENSE`) with a few functions added for this project.
Stock pyegui has no pointer input, no way to update an image after it is loaded,
and no dialogs, so these features couldn't be built without changes.

## What changed compared to upstream

- `src/extensions.rs`: **new**, all the added functions
- `src/lib.rs`: two lines (`mod extensions;` and `extensions::register(m)?;` in the module init)
- `pyproject.toml`: a `[tool.uv] cache-keys` section so `uv` rebuilds the package when the Rust sources change

All other upstream files are unchanged. To update from upstream, copy the new upstream sources over this folder and re-apply those three changes.

Each function also has a docstring, so `help(pyegui.canvas)` works.

## `set_texture(name, width, height, rgba, nearest=False)`

Uploads raw pixels as a named GPU texture, or replaces the pixels of an existing texture with the same name.
It must be called inside the update function.

| arg | type | |
|---|---|---|
| `name` | `str` | texture name, referenced by `canvas` |
| `width`, `height` | `int` | size in pixels |
| `rgba` | `bytes` | exactly `width * height * 4` bytes of unmultiplied RGBA |
| `nearest` | `bool` | nearest-neighbour instead of linear filtering |

Why: `image("file://...")` goes through egui's loader cache, which keys images by uri and never reloads them.
That makes it unusable for images that change. With `set_texture` you can re-upload on every edit:

```python
img = PIL.Image.open("photo.png").convert("RGBA")
# inside update_func, only when the image changed:
set_texture("photo", img.width, img.height, img.tobytes())
```

## `free_texture(name)`

Drops a texture created by `set_texture`. Unknown names are ignored.

## `canvas(texture, max_width=None, max_height=None, max_scale=1.0, selection=None, stroke=None, stroke_color=(0, 0, 0), stroke_width=1.0, cursor_radius=None) -> dict`

Shows a texture as an interactive widget (egui `Sense::click_and_drag`) and reports what the pointer does over it.
It can also draw a few overlays on top of the texture without changing its pixels.

The image is scaled down to fit the available space (and `max_width`/`max_height`, if given), keeping its aspect ratio.
It is never scaled up beyond `max_scale`.
**All coordinates, both arguments and returned values, are in texture pixels**, so you don't need to convert them yourself.

| arg | type | |
|---|---|---|
| `texture` | `str` | name passed to `set_texture` (`KeyError` if missing) |
| `max_width`, `max_height` | `float \| None` | size limits in screen points |
| `max_scale` | `float` | max zoom factor (1.0 = never upscale) |
| `selection` | `(x0, y0, x1, y1) \| None` | rectangle overlay (translucent fill + yellow border) |
| `stroke` | `list[(x, y)] \| None` | polyline overlay with round joins, e.g. a brush stroke in progress |
| `stroke_color` | `(r, g, b)` | floats in 0..1, same as `RGB` |
| `stroke_width` | `float` | in texture pixels |
| `cursor_radius` | `float \| None` | draws a circle of this radius (texture pixels) around the pointer |

Returned dict:

| key | type | |
|---|---|---|
| `pos` | `(x, y) \| None` | pointer position. While dragging it is reported even outside the image, so it can be out of bounds; clamp it yourself |
| `press_origin` | `(x, y) \| None` | where the primary button was pressed. Use it as the start of a drag, because egui only reports `drag_started` after the pointer has moved a few pixels |
| `hovered` | `bool` | |
| `clicked` | `bool` | click without drag |
| `drag_started` | `bool` | first frame of a drag |
| `dragged` | `bool` | a drag is in progress |
| `drag_stopped` | `bool` | the drag ended this frame |
| `scale` | `float` | screen points per texture pixel |

Example: a minimal brush:

```python
points = []

def update_func(ctx):
    global points
    r = canvas("photo", stroke=points or None, stroke_width=4, cursor_radius=2)
    if r["drag_started"]:
        points = [r["press_origin"]]
    if r["dragged"] and r["pos"]:
        points.append(r["pos"])
    if r["drag_stopped"]:
        commit_to_image(points)   # e.g. PIL.ImageDraw.line, then set_texture again
        points = []
```

## `modal(id, open, update_fun)`

Shows `update_fun`'s widgets in a modal dialog (egui `Modal`) above the whole app while `open.value` is True.
The rest of the app is dimmed and can't be used until the dialog closes.
Clicking outside the dialog or pressing Escape sets `open.value = False`.
The update function can also close it by setting `open.value = False`.

| arg | type | |
|---|---|---|
| `id` | `str` | unique id of the dialog |
| `open` | `Bool` | visibility flag |
| `update_fun` | `Callable[[], None]` | draws the dialog contents |

```python
dialog_open = Bool(False)

def dialog():
    heading("Are you sure?")
    if button_clicked("Close"):
        dialog_open.value = False

def update_func(ctx):
    if button_clicked("Open dialog"):
        dialog_open.value = True
    modal("confirm", dialog_open, dialog)
```

## Building

`uv sync` from the project root builds this package with maturin (release mode) and installs it into `.venv`.
This needs a Rust toolchain. The first build compiles egui/wgpu and takes a few minutes.
After that, a change to any `.rs` file triggers a rebuild on the next `uv sync` or `uv run`.

For a faster edit-compile loop while working on the Rust code, `cargo check` in this folder only type-checks the code.
