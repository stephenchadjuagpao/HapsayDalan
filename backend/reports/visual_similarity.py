"""Local image fingerprints; no external API or paid image service."""
import base64
import warnings

from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

MAX_VISUAL_PIXELS = 24_000_000
MAX_HASH_DISTANCE = 24  # Out of 256 gradient comparisons; not a probability.
MAX_COLOR_DIFFERENCE = 18


def _region_signature(image):
    gray = image.convert("L")
    contrast = ImageStat.Stat(gray).stddev[0]
    pixels = gray.resize((17, 16), Image.Resampling.LANCZOS).tobytes()
    bits = 0
    for row in range(16):
        for column in range(16):
            index = row * 17 + column
            bits = (bits << 1) | (pixels[index] > pixels[index + 1])
    if contrast < 10 or not 8 <= bits.bit_count() <= 248:
        return None  # Plain backgrounds and simple gradients are ambiguous.
    return {"hash": f"{bits:064x}", "color": base64.b64encode(
        image.resize((5, 5), Image.Resampling.LANCZOS).tobytes()).decode("ascii")}


def visual_fingerprint(file):
    """Normalize orientation and size, and fingerprint full image + crop windows.

    Undecodable/oversized images and videos keep exact-file detection only.
    The original upload stream is restored and is never modified.
    """
    position = file.tell()
    try:
        file.seek(0)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(file) as source:
                if source.width * source.height > MAX_VISUAL_PIXELS:
                    return {}
                source.draft("RGB", (1024, 1024))
                image = ImageOps.exif_transpose(source)
                image.thumbnail((512, 512), Image.Resampling.LANCZOS)
                rgba = image.convert("RGBA")
                image = Image.alpha_composite(Image.new("RGBA", rgba.size, "white"), rgba).convert("RGB")
                width, height = image.size
                if min(width, height) < 48:
                    return {}
                regions = [_region_signature(image)]
                # Compare a full image against these windows of the other image,
                # never two small patches that could occur in unrelated photos.
                for x_scale, y_scale in ((0.9, 0.9), (0.8, 0.8), (0.65, 0.65), (0.9, 1), (0.8, 1), (1, 0.9), (1, 0.8)):
                    crop_width, crop_height = round(width * x_scale), round(height * y_scale)
                    anchors = ((0.5, 0.5), (0, 0), (1, 0), (0, 1), (1, 1))
                    boxes = set()
                    for x_anchor, y_anchor in anchors:
                        left, top = round((width - crop_width) * x_anchor), round((height - crop_height) * y_anchor)
                        if (left, top) in boxes:
                            continue
                        boxes.add((left, top))
                        regions.append(_region_signature(image.crop((left, top, left + crop_width, top + crop_height))))
                return {"version": 1, "regions": regions}
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return {}
    finally:
        file.seek(position)


def _similar_region(first, second):
    if not first or not second:
        return False
    try:
        difference = (int(first["hash"], 16) ^ int(second["hash"], 16)).bit_count()
        if difference > 36:
            return False
        colors_a = base64.b64decode(first["color"], validate=True)
        colors_b = base64.b64decode(second["color"], validate=True)
        if len(colors_a) != 75 or len(colors_b) != 75:
            return False
        color_difference = sum(abs(a - b) for a, b in zip(colors_a, colors_b)) / 75
        # Fine texture can change gradient bits after downsampling. Permit a
        # slightly larger difference only when the color layout is very close.
        return (color_difference <= MAX_COLOR_DIFFERENCE and
                (difference <= MAX_HASH_DISTANCE or color_difference <= 8))
    except (KeyError, TypeError, ValueError):
        return False


def visually_similar(first, second):
    if not first or not second or first.get("version") != 1 or second.get("version") != 1:
        return False
    regions_a, regions_b = first.get("regions", []), second.get("regions", [])
    if not regions_a or not regions_b:
        return False
    return (any(_similar_region(regions_a[0], region) for region in regions_b) or
            any(_similar_region(region, regions_b[0]) for region in regions_a[1:]))
