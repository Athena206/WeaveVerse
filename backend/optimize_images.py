from __future__ import annotations

import os
from pathlib import Path

import pymysql
from dotenv import dotenv_values
from PIL import Image, ImageEnhance, ImageOps

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
EDITORIAL_DIR = UPLOAD_DIR / "editorial"
EDITORIAL_DIR.mkdir(parents=True, exist_ok=True)

ENV = dotenv_values(BASE_DIR / ".env")


def sensory_profile(fabric: str, category: str) -> dict[str, object]:
    f = fabric.lower()
    if "mulmul" in f:
        return {
            "weight_grams": 320,
            "drape_feel": "Featherlight & cloud-soft",
            "sheerness": "Semi-sheer",
            "care_instructions": "Gentle cold hand wash separately, dry in shade",
            "weight_score": 20,
            "drape_score": 88,
            "sheerness_score": 55,
            "luster_score": 25,
        }
    if "organza" in f or "chiffon" in f:
        return {
            "weight_grams": 350,
            "drape_feel": "Crisp & ethereal float",
            "sheerness": "Translucent",
            "care_instructions": "Dry clean only, steam lightly on low heat",
            "weight_score": 22,
            "drape_score": 84,
            "sheerness_score": 78,
            "luster_score": 68,
        }
    if "linen" in f:
        return {
            "weight_grams": 430,
            "drape_feel": "Breathable & softly structured",
            "sheerness": "Opaque",
            "care_instructions": "Hand wash cold with mild detergent, medium iron",
            "weight_score": 42,
            "drape_score": 74,
            "sheerness_score": 22,
            "luster_score": 38,
        }
    if "tussar" in f:
        return {
            "weight_grams": 510,
            "drape_feel": "Textured & sculpted pleats",
            "sheerness": "Opaque",
            "care_instructions": "Dry clean only, wrap in unbleached cotton muslin",
            "weight_score": 58,
            "drape_score": 76,
            "sheerness_score": 15,
            "luster_score": 72,
        }
    if "silk" in f and "cotton" not in f:
        is_bridal = category.lower() == "wedding"
        return {
            "weight_grams": 680 if is_bridal else 540,
            "drape_feel": "Regal & structured pleats" if is_bridal else "Fluid & lustrous",
            "sheerness": "Opaque",
            "care_instructions": "Dry clean only, refold every 3 months in muslin",
            "weight_score": 78 if is_bridal else 60,
            "drape_score": 82,
            "sheerness_score": 10,
            "luster_score": 92 if is_bridal else 84,
        }
    if "silk" in f and "cotton" in f:
        return {
            "weight_grams": 440,
            "drape_feel": "Airy with subtle sheen",
            "sheerness": "Subtly sheer",
            "care_instructions": "Dry clean first wash, then gentle cold hand wash",
            "weight_score": 40,
            "drape_score": 86,
            "sheerness_score": 40,
            "luster_score": 66,
        }
    if "georgette" in f or "crepe" in f:
        return {
            "weight_grams": 420,
            "drape_feel": "Liquid & effortless fall",
            "sheerness": "Subtly sheer",
            "care_instructions": "Dry clean recommended, cool iron on reverse",
            "weight_score": 36,
            "drape_score": 95,
            "sheerness_score": 38,
            "luster_score": 58,
        }
    return {
        "weight_grams": 450,
        "drape_feel": "Crisp & breathable weave",
        "sheerness": "Opaque",
        "care_instructions": "Gentle cold hand wash, dry in shade",
        "weight_score": 45,
        "drape_score": 78,
        "sheerness_score": 20,
        "luster_score": 32,
    }


def polish_image(img: Image.Image) -> Image.Image:
    img = ImageOps.exif_transpose(img).convert("RGB")
    img = ImageEnhance.Contrast(img).enhance(1.06)
    img = ImageEnhance.Color(img).enhance(1.05)
    img = ImageEnhance.Sharpness(img).enhance(1.12)
    return img


def make_3_4_crop(img: Image.Image, center_y: float = 0.22, out_size: tuple[int, int] = (960, 1280)) -> Image.Image:
    return ImageOps.fit(img, out_size, method=Image.Resampling.LANCZOS, centering=(0.5, center_y))


def make_detail_crop(img: Image.Image, box_norm: tuple[float, float, float, float], out_size: tuple[int, int] = (960, 1280)) -> Image.Image:
    w, h = img.size
    left = int(w * box_norm[0])
    top = int(h * box_norm[1])
    right = int(w * box_norm[2])
    bottom = int(h * box_norm[3])
    cropped = img.crop((left, top, max(left + 40, right), max(top + 40, bottom)))
    return ImageOps.fit(cropped, out_size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def main() -> None:
    conn = pymysql.connect(
        host=ENV.get("MYSQL_HOST", "127.0.0.1"),
        port=int(ENV.get("MYSQL_PORT", "3307")),
        user=ENV.get("MYSQL_USER", "fsc_app"),
        password=ENV.get("MYSQL_PASSWORD", ""),
        database=ENV.get("MYSQL_DATABASE", "first_saree_centre"),
        charset="utf8mb4",
        autocommit=False,
    )
    processed = 0
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("SELECT product_id, saree_name, category, fabric, image_url FROM sarees WHERE is_active = TRUE")
            products = cur.fetchall()

            for p in products:
                pid = p["product_id"]
                rel_url = p["image_url"]
                # Support re-runs cleanly by resolving from original uploads if already editorial
                filename = Path(rel_url).name
                if filename.endswith("-drape.jpg"):
                    orig_candidates = list(UPLOAD_DIR.glob(f"{filename.replace('-drape.jpg', '')}.*"))
                    src_path = orig_candidates[0] if orig_candidates else (EDITORIAL_DIR / filename)
                else:
                    src_path = UPLOAD_DIR / filename

                if not src_path.exists():
                    continue

                with Image.open(src_path) as raw:
                    img = polish_image(raw)
                    stem = f"saree-{pid:02d}"
                    drape_path = EDITORIAL_DIR / f"{stem}-drape.jpg"
                    pallu_path = EDITORIAL_DIR / f"{stem}-pallu.jpg"
                    border_path = EDITORIAL_DIR / f"{stem}-border.jpg"

                    make_3_4_crop(img, center_y=0.18).save(drape_path, "JPEG", quality=90, optimize=True)
                    make_detail_crop(img, (0.18, 0.34, 0.86, 0.88)).save(pallu_path, "JPEG", quality=88, optimize=True)
                    make_detail_crop(img, (0.24, 0.55, 0.90, 0.98)).save(border_path, "JPEG", quality=88, optimize=True)

                drape_url = f"/uploads/editorial/{stem}-drape.jpg"
                pallu_url = f"/uploads/editorial/{stem}-pallu.jpg"
                border_url = f"/uploads/editorial/{stem}-border.jpg"

                prof = sensory_profile(p["fabric"], p["category"])
                cur.execute(
                    """
                    UPDATE sarees
                    SET image_url = %s,
                        focal_point = %s,
                        weight_grams = %s,
                        drape_feel = %s,
                        sheerness = %s,
                        care_instructions = %s,
                        weight_score = %s,
                        drape_score = %s,
                        sheerness_score = %s,
                        luster_score = %s
                    WHERE product_id = %s
                    """,
                    (
                        drape_url,
                        "50% 18%",
                        prof["weight_grams"],
                        prof["drape_feel"],
                        prof["sheerness"],
                        prof["care_instructions"],
                        prof["weight_score"],
                        prof["drape_score"],
                        prof["sheerness_score"],
                        prof["luster_score"],
                        pid,
                    ),
                )

                cur.execute("DELETE FROM saree_images WHERE product_id = %s", (pid,))
                cur.executemany(
                    "INSERT INTO saree_images (product_id, image_url, shot_type, sort_order) VALUES (%s, %s, %s, %s)",
                    [
                        (pid, drape_url, "drape", 0),
                        (pid, pallu_url, "pallu", 1),
                        (pid, border_url, "border", 2),
                    ],
                )
                processed += 1
        conn.commit()
    finally:
        conn.close()
    print(f"Optimized editorial 3:4 & detail images for {processed} sarees.")


if __name__ == "__main__":
    main()
