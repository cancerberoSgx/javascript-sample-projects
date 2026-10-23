"""Runs one of the example apps in src/.

    uv run main.py                 # default app (image-viewer)
    uv run main.py example         # a specific app

To add an app, create src/<app>/ with a main() and register it in APPS.
Imports stay static (inside functions) so PyInstaller can find them.
"""

import sys


def image_viewer():
    from src.image_viewer.app import main

    main()


def example():
    from src.example import main

    main()


APPS = {
    "image-viewer": image_viewer,
    "example": example,
}
DEFAULT_APP = "image-viewer"


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_APP
    if name not in APPS:
        sys.exit(f"Unknown app '{name}'. Available: {', '.join(APPS)}")
    APPS[name]()


if __name__ == "__main__":
    main()
