import re
import uuid


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def unique_slug(base: str, existing_slugs: set[str]) -> str:
    slug = slugify(base)
    if slug not in existing_slugs:
        return slug
    for i in range(2, 1000):
        candidate = f"{slug}-{i}"
        if candidate not in existing_slugs:
            return candidate
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def generate_sku(name: str, prefix: str = "") -> str:
    base = re.sub(r"[^A-Z0-9]", "", name.upper())[:6].ljust(3, "X")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"{prefix}{base}-{suffix}" if prefix else f"{base}-{suffix}"
