"""Image viewer / editor: open, draw, filter, resize and clip images.

Uses the project's extended pyegui (see vendor/pyegui/EXTENSIONS.md) for
set_texture, canvas and modal.
"""

import math
import os

from pyegui import (
    RGB,
    Bool,
    Int,
    Float,
    Str,
    button_clicked,
    canvas,
    checkbox,
    color_edit_button_rgb,
    drag_int,
    heading,
    horizontal,
    horizontal_wrapped,
    label,
    modal,
    radio_value,
    run_native,
    separator,
    set_texture,
    slider_float,
    slider_int,
    text_edit_singleline,
    weak,
)

from .editor import FILTERS, OPEN_EXTENSIONS, Editor

TEXTURE = "image"
DRAW, CLIP = 0, 1

editor = Editor()
uploaded_version = -1
message = ""

path = Str("")
mode = Int(DRAW)
color = RGB(0.9, 0.1, 0.1)
pencil_width = Int(5)
blur_radius = Float(2.0)

# stroke being drawn / rectangle being selected, in image pixels
stroke: list[tuple[float, float]] = []
selection: tuple[float, float, float, float] | None = None
pointer: tuple[float, float] | None = None

resize_open = Bool(False)
resize_w = Int(0)
resize_h = Int(0)
keep_aspect = Bool(True)
last_resize = (0, 0)


# file dialogs (tkinter ships with Python; pyegui has no file dialog)


def _ask_path(save: bool) -> str | None:
    import tkinter
    from tkinter import filedialog

    root = tkinter.Tk()
    root.withdraw()
    try:
        if save:
            name = os.path.basename(editor.path or "image.png")
            result = filedialog.asksaveasfilename(parent=root, initialfile=name, defaultextension=".png")
        else:
            patterns = " ".join(f"*{ext}" for ext in OPEN_EXTENSIONS)
            result = filedialog.askopenfilename(
                parent=root, filetypes=[("Images", patterns), ("All files", "*")]
            )
        return result or None
    finally:
        root.destroy()


def open_image(file_path: str):
    global message
    try:
        editor.load(file_path)
        path.value = file_path
        message = ""
    except Exception as e:
        message = f"Cannot open '{file_path}': {e}"


def save_image():
    global message
    file_path = _ask_path(save=True)
    if not file_path:
        return
    try:
        editor.save(file_path)
        path.value = file_path
        message = f"Saved {file_path}"
    except Exception as e:
        message = f"Cannot save '{file_path}': {e}"


# UI sections


def file_bar():
    if button_clicked("Open…"):
        file_path = _ask_path(save=False)
        if file_path:
            open_image(file_path)
    text_edit_singleline(path, hint_text="or type a path and press Load")
    if button_clicked("Load"):
        open_image(path.value.strip())
    if editor.image is not None:
        if button_clicked("Save as…"):
            save_image()
        if editor.can_undo() and button_clicked("Undo"):
            editor.undo()


def tool_bar():
    radio_value(mode, DRAW, "Draw")
    radio_value(mode, CLIP, "Clip")
    separator()
    if mode.value == DRAW:
        label("Color")
        color_edit_button_rgb(color)
        slider_int(pencil_width, 1, 100, "pencil width")
    else:
        weak("Drag a rectangle over the image to clip it")
    separator()
    if button_clicked("Resize…"):
        open_resize()


def filter_bar():
    label("Filters:")
    for name in FILTERS:
        if button_clicked(name):
            editor.apply_filter(name, blur_radius.value)
    if button_clicked("Grayscale"):
        editor.grayscale()
    slider_float(blur_radius, 0.5, 20.0, "blur radius")


def status_bar():
    w, h = editor.image.size
    text = f"{w} x {h} px"
    if pointer is not None:
        text += f"   ·   x {pointer[0]:.0f}, y {pointer[1]:.0f}"
    weak(text)


def open_resize():
    global last_resize
    resize_w.value, resize_h.value = editor.image.size
    last_resize = editor.image.size
    resize_open.value = True


def resize_dialog():
    global last_resize
    w, h = editor.image.size
    heading("Resize image")
    label(f"Current size: {w} x {h} px")
    horizontal(lambda: (label("Width "), drag_int(resize_w, 1, 20000, 1)))
    horizontal(lambda: (label("Height"), drag_int(resize_h, 1, 20000, 1)))
    checkbox(keep_aspect, "Keep aspect ratio")

    # whichever field the user changed drives the other one
    if keep_aspect.value:
        if resize_w.value != last_resize[0]:
            resize_h.value = max(1, round(resize_w.value * h / w))
        elif resize_h.value != last_resize[1]:
            resize_w.value = max(1, round(resize_h.value * w / h))
    last_resize = (resize_w.value, resize_h.value)

    def buttons():
        if button_clicked("Apply"):
            editor.resize(resize_w.value, resize_h.value)
            resize_open.value = False
        if button_clicked("Cancel"):
            resize_open.value = False

    horizontal(buttons)


def image_canvas():
    global stroke, selection, pointer
    w, h = editor.image.size
    drawing = mode.value == DRAW
    r = canvas(
        TEXTURE,
        selection=selection,
        stroke=stroke or None,
        stroke_color=(color.r, color.g, color.b),
        stroke_width=pencil_width.value,
        cursor_radius=pencil_width.value / 2 if drawing else None,
    )

    pos = r["pos"]
    if pos is not None:
        pos = (min(max(pos[0], 0), w), min(max(pos[1], 0), h))
    pointer = pos if r["hovered"] or r["dragged"] else None
    start = r["press_origin"] or pos

    if drawing:
        if r["drag_started"]:
            stroke = [start]
        if r["dragged"] and pos and stroke and math.dist(stroke[-1], pos) >= 1:
            stroke.append(pos)
        if r["drag_stopped"] and stroke:
            editor.draw_stroke(stroke, rgb255(color), pencil_width.value)
            stroke = []
        if r["clicked"] and pos:
            editor.draw_stroke([pos], rgb255(color), pencil_width.value)
    else:
        if r["drag_started"]:
            selection = (*start, *start)
        if r["dragged"] and pos and selection:
            selection = (selection[0], selection[1], *pos)
        if r["drag_stopped"] and selection:
            editor.crop(*selection)
            selection = None


def rgb255(c: RGB) -> tuple[int, int, int]:
    return round(c.r * 255), round(c.g * 255), round(c.b * 255)


def update(ctx):
    global uploaded_version
    horizontal_wrapped(file_bar)
    if message:
        label(message)
    separator()

    if editor.image is None:
        weak("Open an image to start (" + ", ".join(OPEN_EXTENSIONS) + ")")
        return

    if uploaded_version != editor.version:
        set_texture(TEXTURE, *editor.image.size, editor.rgba_bytes())
        uploaded_version = editor.version

    horizontal_wrapped(tool_bar)
    horizontal_wrapped(filter_bar)
    status_bar()
    image_canvas()
    modal("resize", resize_open, resize_dialog)


def main():
    run_native("Image Viewer", update, inner_width=1100, inner_height=800)
