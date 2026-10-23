"""Image editing operations (Pillow), independent of the UI."""

from PIL import Image, ImageDraw, ImageFilter, ImageOps

# extensions offered in the open dialog; Pillow can read all of them out of the box
OPEN_EXTENSIONS = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff", ".ico", ".ppm")
HISTORY_LIMIT = 20

EDGE_KERNEL = ImageFilter.Kernel((3, 3), [-1, -1, -1, -1, 8, -1, -1, -1, -1], scale=1)

# name -> filter factory; the radius only matters for blurs
FILTERS = {
    "Gaussian blur": lambda r: ImageFilter.GaussianBlur(r),
    "Box blur (flat kernel)": lambda r: ImageFilter.BoxBlur(r),
    "Sharpen": lambda r: ImageFilter.SHARPEN,
    "Edge detection": lambda r: EDGE_KERNEL,
    "Emboss": lambda r: ImageFilter.EMBOSS,
}


def _to_rgb(img: Image.Image) -> Image.Image:
    """Flatten transparency onto white so every operation can work in RGB."""
    if img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.getchannel("A"))
        return background
    return img.convert("RGB")


class Editor:
    def __init__(self):
        self.image: Image.Image | None = None
        self.path: str | None = None
        self.history: list[Image.Image] = []
        # bumped on every change so the UI knows when to re-upload the texture
        self.version = 0

    def load(self, path: str):
        with Image.open(path) as img:
            self.image = _to_rgb(img)
        self.path = path
        self.history.clear()
        self.version += 1

    def save(self, path: str):
        self.image.save(path)
        self.path = path

    def can_undo(self) -> bool:
        return bool(self.history)

    def undo(self):
        if self.history:
            self.image = self.history.pop()
            self.version += 1

    def _commit(self, image: Image.Image):
        self.history.append(self.image)
        del self.history[:-HISTORY_LIMIT]
        self.image = image
        self.version += 1

    def apply_filter(self, name: str, radius: float = 2.0):
        self._commit(self.image.filter(FILTERS[name](radius)))

    def grayscale(self):
        self._commit(ImageOps.grayscale(self.image).convert("RGB"))

    def resize(self, width: int, height: int):
        if (width, height) != self.image.size:
            self._commit(self.image.resize((width, height), Image.Resampling.LANCZOS))

    def crop(self, x0: float, y0: float, x1: float, y1: float) -> bool:
        """Crop to the rectangle (any corner order). Returns False if it's too small."""
        w, h = self.image.size
        left, right = sorted((round(x0), round(x1)))
        top, bottom = sorted((round(y0), round(y1)))
        left, right = max(0, left), min(w, right)
        top, bottom = max(0, top), min(h, bottom)
        if right - left < 2 or bottom - top < 2:
            return False
        self._commit(self.image.crop((left, top, right, bottom)))
        return True

    def draw_stroke(self, points: list[tuple[float, float]], color: tuple[int, int, int], width: int):
        image = self.image.copy()
        draw = ImageDraw.Draw(image)
        if len(points) > 1:
            draw.line(points, fill=color, width=width, joint="curve")
        # round caps; a single point is a dot
        r = width / 2
        for x, y in (points[0], points[-1]):
            draw.ellipse((x - r, y - r, x + r, y + r), fill=color)
        self._commit(image)

    def rgba_bytes(self) -> bytes:
        return self.image.convert("RGBA").tobytes()
