"""Minimal interactive egui UI written in Python via pyegui."""

from pyegui import (
    Bool,
    Int,
    Str,
    button_clicked,
    checkbox,
    collapsing,
    heading,
    horizontal,
    label,
    radio_value,
    run_native,
    separator,
    slider_int,
    text_edit_singleline,
)

LIGHT, DARK = 0, 1

name = Str("")
counter = Int(0)
size = Int(5)
show_details = Bool(True)
theme = Int(DARK)


def counter_row():
    if button_clicked("-"):
        counter.value -= 1
    label(f"Counter: {counter.value}")
    if button_clicked("+"):
        counter.value += 1
    if button_clicked("Reset"):
        counter.value = 0


def theme_row():
    radio_value(theme, LIGHT, "Light")
    radio_value(theme, DARK, "Dark")


def details():
    label(f"Name length: {len(name.value)}")
    label(f"Counter x size: {counter.value * size.value}")


def update(ctx):
    if theme.value == LIGHT:
        ctx.set_light_theme()
    else:
        ctx.set_dark_theme()

    heading("egui + Python probe")
    separator()

    text_edit_singleline(name, hint_text="Your name")
    label(f"Hello, {name.value or 'stranger'}!")
    separator()

    horizontal(counter_row)
    slider_int(size, 1, 10, "size")
    separator()

    horizontal(theme_row)
    checkbox(show_details, "Show details")
    if show_details.value:
        collapsing("Details", details)


def main():
    run_native("egui Python Probe", update)


if __name__ == "__main__":
    main()
