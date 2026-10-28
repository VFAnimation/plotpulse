"""
Draws simple stylised 360° placeholder panoramas (2:1 equirectangular JPGs)
for the demo tour. Replace them with real renders from your 3D scene:
export equirectangular 2:1 images (6144×3072 is a good balance for phones).
"""
import os, random
from PIL import Image, ImageDraw, ImageFilter

W, H = 4096, 2048
HZ = H // 2
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
outdir = os.path.join(root, "colony", "panos")
os.makedirs(outdir, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def base(sky_top, sky_bottom, ground_near, ground_far):
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    for y in range(HZ):
        d.line([(0, y), (W, y)], fill=lerp(sky_top, sky_bottom, (y / HZ) ** 1.6))
    for y in range(HZ, H):
        d.line([(0, y), (W, y)], fill=lerp(ground_far, ground_near, ((y - HZ) / HZ) ** 0.7))
    return im, d


def tree(d, x, size, dark=(52, 96, 58), light=(84, 134, 74)):
    trunk_h = int(size * 0.6)
    d.rectangle([x - size * 0.06, HZ - trunk_h, x + size * 0.06, HZ + 4], fill=(96, 72, 52))
    for i, s in enumerate((1.0, 0.8, 0.6)):
        r = int(size * 0.45 * s)
        cy = HZ - trunk_h - int(size * 0.25 * i)
        d.ellipse([x - r, cy - r, x + r, cy + r], fill=dark if i % 2 == 0 else light)


def house(d, x, w, h, wall, roof=(70, 70, 76)):
    d.rectangle([x, HZ - h, x + w, HZ + 3], fill=wall)
    d.rectangle([x - 6, HZ - h - 14, x + w + 6, HZ - h], fill=roof)
    win = (52, 64, 82)
    for wx in range(x + 18, x + w - 30, 46):
        d.rectangle([wx, HZ - h + 24, wx + 22, HZ - h + 52], fill=win)
        if h > 120:
            d.rectangle([wx, HZ - h + 80, wx + 22, HZ - h + 108], fill=win)


def road_band(d, color=(92, 92, 96), y0=HZ + 30, y1=HZ + 210, x0=0, x1=W):
    d.rectangle([x0, y0, x1, y1], fill=color)
    for x in range(x0, x1, 160):
        d.rectangle([x, (y0 + y1) // 2 - 4, x + 70, (y0 + y1) // 2 + 4], fill=(230, 226, 200))


def finish(im, name):
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    im.save(os.path.join(outdir, name), quality=82, optimize=True, progressive=True)
    print("wrote", name)


random.seed(3)
walls = [(226, 214, 196), (214, 206, 190), (232, 224, 212), (205, 190, 170), (238, 232, 222)]

# 1. Entrance gate — gate pillars straight ahead (yaw 0 = image centre)
im, d = base((120, 170, 214), (214, 228, 236), (122, 128, 110), (150, 160, 132))
road_band(d)
for x in range(0, W, 260):
    if abs(x - W // 2) > 500:
        tree(d, x + random.randint(-40, 40), random.randint(150, 230))
cx = W // 2
for px in (cx - 300, cx + 240):
    d.rectangle([px, HZ - 330, px + 60, HZ + 30], fill=(178, 150, 116))
    d.rectangle([px - 12, HZ - 350, px + 72, HZ - 330], fill=(140, 112, 84))
d.rectangle([cx - 240, HZ - 300, cx + 240, HZ - 250], fill=(64, 82, 68))
finish(im, "entrance.jpg")

# 2. Central park — lawn, ring of trees, houses behind
im, d = base((106, 160, 210), (206, 224, 234), (98, 150, 84), (132, 170, 104))
x = 0
while x < W:
    w = random.randint(220, 320)
    house(d, x, w, random.randint(110, 170), random.choice(walls))
    x += w + random.randint(30, 80)
for x in range(60, W, 170):
    tree(d, x + random.randint(-30, 30), random.randint(170, 260))
d.ellipse([W // 2 - 600, HZ + 260, W // 2 + 600, HZ + 520], fill=(176, 160, 132))
finish(im, "park.jpg")

# 3. Internal road — houses lining both sides
im, d = base((132, 176, 214), (220, 230, 236), (120, 124, 112), (150, 152, 136))
road_band(d, y0=HZ + 20, y1=HZ + 260)
x = 0
while x < W:
    w = random.randint(240, 340)
    if not (W // 2 - 160 < x + w / 2 < W // 2 + 160) and not (x + w / 2 < 160 or x + w / 2 > W - 160):
        house(d, x, w, random.randint(120, 190), random.choice(walls))
    x += w + random.randint(20, 60)
for x in range(0, W, 340):
    tree(d, x + random.randint(-20, 20), random.randint(120, 180))
finish(im, "road.jpg")
