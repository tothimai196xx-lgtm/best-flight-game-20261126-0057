#!/usr/bin/env python3
"""Generate the procedural texture assets for Golden Hour Courier.

Every texture is drawn from scratch in this script (seeded random + PIL):
no downloaded images. They are loaded by game/src/world.js at runtime.
"""
import math
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = "/home/hatch/workspace/makefun-bounty/best-flight-game-20261126-0057/game/assets"

# --- cloud.png: a soft billowing blob with a noisy edge -------------------
def cloud():
    rng = random.Random(41)
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Overlapping puffs build the cloud body.
    puffs = [(128, 150, 62), (88, 158, 48), (168, 158, 50), (110, 122, 44),
             (150, 120, 42), (128, 96, 34), (70, 138, 30), (188, 136, 30)]
    for (x, y, r) in puffs:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 235))
    img = img.filter(ImageFilter.GaussianBlur(7))
    # Ragged alpha edge: punch soft holes along the rim.
    px = img.load()
    for _ in range(900):
        a = rng.uniform(0, math.pi * 2)
        rr = rng.uniform(52, 96)
        x = int(128 + math.cos(a) * rr)
        y = int(150 + math.sin(a) * rr * 0.75)
        if 0 <= x < size and 0 <= y < size:
            r, g, b, al = px[x, y]
            px[x, y] = (r, g, b, max(0, al - rng.randint(40, 130)))
    img = img.filter(ImageFilter.GaussianBlur(2))
    img.save(f"{OUT}/cloud.png")

# --- water.png: tileable wave streaks -------------------------------------
def water():
    rng = random.Random(97)
    size = 256
    img = Image.new("RGB", (size, size), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    for _ in range(240):
        x = rng.uniform(0, size)
        y = rng.uniform(0, size)
        length = rng.uniform(14, 64)
        shade = rng.randint(205, 242)
        draw.line([x, y, x + length, y], fill=(shade, shade, shade), width=1)
        # Wrap the streak so the tile repeats seamlessly.
        if x + length > size:
            draw.line([x - size, y, x + length - size, y], fill=(shade, shade, shade), width=1)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    img.save(f"{OUT}/water.png")

# --- runway.png: asphalt with centreline, thresholds, 09/27 --------------
def runway():
    rng = random.Random(7)
    w, h = 256, 1024
    img = Image.new("RGB", (w, h), (51, 55, 61))
    draw = ImageDraw.Draw(img)
    # Asphalt speckle.
    for _ in range(5200):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        v = rng.randint(48, 78)
        draw.point([x, y], fill=(v, v + 2, v + 5))
    # Faint tyre-darkened wheel tracks.
    for cx in (86, 170):
        draw.rectangle([cx - 16, 40, cx + 16, h - 40], fill=(40, 43, 48))
    # Centreline dashes.
    for y in range(70, h - 50, 64):
        draw.rectangle([w // 2 - 4, y, w // 2 + 4, y + 34], fill=(245, 245, 240))
    # Threshold bars.
    draw.rectangle([14, 26, w - 14, 36], fill=(245, 245, 240))
    draw.rectangle([14, h - 36, w - 14, h - 26], fill=(245, 245, 240))
    # Edge lines.
    draw.rectangle([0, 0, 6, h], fill=(255, 200, 87))
    draw.rectangle([w - 6, 0, w, h], fill=(255, 200, 87))
    # Runway numbers, drawn big and bold.
    from PIL import ImageFont
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 84)
    except Exception:
        font = ImageFont.load_default()
    draw.text((w // 2, h - 108), "09", fill=(245, 245, 240), font=font, anchor="mm")
    num = Image.new("RGBA", (w, 130), (0, 0, 0, 0))
    nd = ImageDraw.Draw(num)
    nd.text((w // 2, 65), "27", fill=(245, 245, 240, 255), font=font, anchor="mm")
    num = num.rotate(180)
    img.paste(num, (0, 60), num)
    img.save(f"{OUT}/runway.png")

# --- terrain-grain.png: subtle light grain multiplied over vertex colours --
def grain():
    size = 512
    img = Image.effect_noise((size, size), 46).convert("L")
    # Lift the range so the map stays bright: 214..255, a whisper of grain.
    img = img.point(lambda v: 214 + (v * 41) // 255)
    # A few darker speckles for rocky patches.
    rng = random.Random(2024)
    draw = ImageDraw.Draw(img)
    for _ in range(2600):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        draw.ellipse([x, y, x + rng.uniform(1, 3), y + rng.uniform(1, 3)],
                     fill=rng.randint(150, 205))
    img.save(f"{OUT}/terrain-grain.png")

cloud()
water()
runway()
grain()
print("textures written")
