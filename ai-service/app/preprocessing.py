import io
from PIL import Image, UnidentifiedImageError

MAX_PIXELS = 25_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class InvalidImageError(ValueError):
    pass


def decode_image(data: bytes) -> Image.Image:
    """Decode and verify an image from raw bytes. Rejects corrupted/unsupported files."""
    if not data:
        raise InvalidImageError("Empty file")
    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()  # detects truncated/corrupt files
        img = Image.open(io.BytesIO(data))
        if img.format not in ("JPEG", "PNG"):
            raise InvalidImageError("Only JPEG and PNG images are supported")
        return img.convert("RGB")
    except InvalidImageError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError) as e:
        raise InvalidImageError(f"Corrupted or unsupported image: {e}")
