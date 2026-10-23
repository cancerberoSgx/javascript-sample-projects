# egui-python-probe1

A playground for writing desktop UIs in Python with [pyegui](https://github.com/GachiLord/pyegui). pyegui provides Python bindings for the Rust immediate-mode GUI library [egui](https://github.com/emilk/egui).

## Apps

Each example app lives in `src/`, and `main.py` picks which one to run:

| name | source | what it does |
|---|---|---|
| `image-viewer` (default) | `src/image_viewer/` | open, draw on, filter, resize and clip images |
| `example` | `src/example.py` | minimal widget demo (text input, counter, slider, theme switch) |

```bash
uv run main.py                # image-viewer
uv run main.py example
```

To add an app, create `src/<app>/` (or `src/<app>.py`) with a `main()` function and register it in `APPS` in `main.py`. Folder names use underscores (`image_viewer`, not `image-viewer`) because they are imported as Python modules.

### Image viewer

- **Open** PNG, JPEG, BMP, GIF, WebP, TIFF, ICO and PPM. Pillow reads all of these out of the box. Use `Open…` for a native file dialog, or type a path and press `Load`. Transparent images are flattened onto white.
- **Draw** mode: click and drag over the image to paint. Pick the color with the color button and the size with the "pencil width" slider. A circle under the pointer shows the brush size.
- **Clip** mode: drag a rectangle. When you release, the image is replaced by the selected area.
- **Filters**: Gaussian blur, box blur (a flat, uniform kernel), sharpen, edge detection (a 3×3 Laplacian convolution), emboss and grayscale. The blur radius slider applies to the two blurs.
- **Resize…** opens a dialog with the current width and height. The fields are editable: drag them or click to type. "Keep aspect ratio" links the two.
- **Undo** (last 20 steps) and **Save as…** (the format comes from the file extension).

The image logic (Pillow) is in `src/image_viewer/editor.py` and the UI in `src/image_viewer/app.py`.

## pyegui: vendored and extended

Stock pyegui 0.5.0 has no mouse input over images, no way to refresh an image after it is shown, and no dialogs. So this project uses a **local fork in `vendor/pyegui/`**, installed through `[tool.uv.sources]` in `pyproject.toml`. The fork adds `set_texture`, `free_texture`, `canvas` (an image that reports clicks and drags in image pixels and draws stroke/selection overlays) and `modal`.

**All added functions are documented in [`vendor/pyegui/EXTENSIONS.md`](vendor/pyegui/EXTENSIONS.md)**, which also covers what changed against upstream and how to re-sync with it. They also have docstrings, so `help(pyegui.canvas)` works.

## How pyegui works

You write one `update(ctx)` function, and egui calls it every frame. Each widget call draws the widget and handles its input in the same step. For example, `button_clicked("+")` returns `True` on the frame when the button is clicked. State lives in `Str`, `Int`, `Bool`, `Float` and `RGB` wrappers, and widgets read and write their `.value` (or `.r/.g/.b`).

## Requirements

- Python 3.11+ (pyegui requires it), with tkinter (used only for the open/save file dialogs; it ships with the python.org installers and with uv-managed Pythons)
- [uv](https://docs.astral.sh/uv/)
- A **Rust toolchain** ([rustup](https://rustup.rs/)), because the vendored pyegui is compiled from source. On Linux you also need the usual egui system libraries (X11/Wayland and OpenGL dev packages). Most desktop distros already have them.

## Local development

```bash
uv sync              # builds vendor/pyegui (first time: a few minutes), installs pillow + pyinstaller
uv run main.py       # opens the image viewer
```

- Python changes: close the window and run again. There is no hot reload.
- Rust changes in `vendor/pyegui/src/`: the next `uv sync` or `uv run` rebuilds the extension automatically (incrementally, so a few seconds). Use `cargo check` inside `vendor/pyegui/` for fast type-checking.

## Building binaries

Binaries are built with [PyInstaller](https://pyinstaller.org/). It bundles the Python interpreter, the apps, Pillow, Tcl/Tk and the native pyegui extension into a single executable.

```bash
uv run pyinstaller --onefile --windowed --name egui-python-probe1 main.py
```

The result is in `dist/`:

| OS      | Output                              |
|---------|-------------------------------------|
| Linux   | `dist/egui-python-probe1` (~58 MB)  |
| Windows | `dist/egui-python-probe1.exe`       |
| macOS   | `dist/egui-python-probe1.app` and `dist/egui-python-probe1` |

The binary takes the same app argument as `main.py`, for example `./dist/egui-python-probe1 example`.

Notes:

- **PyInstaller does not cross-compile.** Build on each target OS: Windows binaries on Windows, macOS binaries on macOS. A CI matrix (for example GitHub Actions with `ubuntu-latest`, `windows-latest` and `macos-latest`, each with Rust installed) is the usual way to produce all three.
- `--windowed` hides the console window on Windows and macOS. Leave it out if you want to see `print` output or tracebacks.
- `--onefile` unpacks to a temp folder on each start, so startup is a bit slower. Use `--onedir` instead for a faster-starting folder build.
- Add an icon with `--icon app.ico` (Windows) or `--icon app.icns` (macOS).
- On Linux the binary links against the build machine's glibc. To support older distros, build on an older distro or in an older container.
- PyInstaller writes `build/`, `dist/` and `*.spec`. They are git-ignored. You can commit the generated `.spec` file and rebuild with `uv run pyinstaller egui-python-probe1.spec` once you start customizing the build.
