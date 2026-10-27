# Textures for the water-hyacinth bag model (product 1), all taken from the product photo.
# atlas.png  : weave for every side of the bag + the flap + its lip
# braid.png  : the real braided toggle loop, laid along U (for the 3D rope)
# wood.png   : light wooden bead with fine grain (bead colour sampled from the photo)
# normal.png : normal map of the atlas (gives the weave depth under light)
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
SRC = '/Users/macspace/Desktop/Final Project/public/uploads/products/prod-1791908152667-202984973.jpg'
OUT = __import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/out/'
__import__('os').makedirs(OUT, exist_ok=True)   # run: python tools/bag-model/texture.py && python tools/bag-model/build.py (needs pillow numpy trimesh scipy)
P = Image.open(SRC).convert('RGB')
rng = np.random.default_rng(7)
PX = 40   # texture pixels per cm

def seamless(img, hfade, vfade):
    a = np.asarray(img, dtype=np.float32)
    h, w = a.shape[:2]
    t = np.linspace(0, 1, hfade)[None, :, None]
    a[:, :hfade] = a[:, :hfade] * t + a[:, w - hfade:] * (1 - t)
    a = a[:, :w - hfade]
    t = np.linspace(0, 1, vfade)[:, None, None]
    a[:vfade] = a[:vfade] * t + a[a.shape[0] - vfade:] * (1 - t)
    a = a[:a.shape[0] - vfade]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

# Real weave: two rows of knots from the top of the flap (above the "maha_saan" watermark)
strip = ImageEnhance.Contrast(P.crop((250, 450, 540, 548))).enhance(1.1)
tile = seamless(strip, 28, 34)
tile = tile.resize((int(tile.width * 1.7), int(tile.height * 1.7)), Image.LANCZOS)   # ~9 knots across 22 cm (as in the photo)

def soft_noise(w, h, cell, amount):
    """Low-frequency brightness variation so the repeat of the tile does not show."""
    g = rng.random((h // cell + 2, w // cell + 2)).astype(np.float32)
    img = Image.fromarray((g * 255).astype(np.uint8)).resize((w + 2 * cell, h + 2 * cell), Image.BICUBIC)
    a = np.asarray(img, dtype=np.float32)[cell:cell + h, cell:cell + w] / 255.0
    return 1.0 + (a - 0.5) * 2 * amount

def weave(w, h, shade=1.0, seed=0):
    img = Image.new('RGB', (w, h))
    ox = (seed * 131) % tile.width
    oy = (seed * 37) % tile.height
    for y in range(-oy, h, tile.height):
        for x in range(-ox, w, tile.width):
            img.paste(tile, (x, y))
    a = np.asarray(img, dtype=np.float32) * shade
    a *= soft_noise(w, h, 90, 0.07)[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

W, H, D = 22 * PX, 18 * PX, 8 * PX
atlas = Image.new('RGB', (2048, 2048), (190, 150, 100))
REGIONS = {   # x, y, w, h (pixels in the 2048 atlas)
    'front': (0, 0, W, H), 'back': (900, 0, W, H), 'top': (0, 740, W, D), 'bottom': (900, 740, W, D),
    'left': (0, 1080, D, H), 'right': (340, 1080, D, H), 'flap': (680, 1080, W, int(H * 0.62)), 'lip': (680, 1560, W, 60),
}
shades = {'front': 0.97, 'back': 0.93, 'top': 1.04, 'bottom': 0.78, 'left': 0.92, 'right': 0.92, 'flap': 1.03, 'lip': 0.62}
for i, (name, (x, y, w, h)) in enumerate(REGIONS.items()):
    atlas.paste(weave(w, h, shades[name], i + 1), (x, y))
# Golden tan of the real bag (the photo strip is brighter than the bag body)
atlas = ImageEnhance.Color(atlas).enhance(1.15)
atlas = ImageEnhance.Brightness(atlas).enhance(0.88)
atlas = ImageEnhance.Contrast(atlas).enhance(1.0)
a = np.asarray(atlas, dtype=np.float32)
fy = int(H * 0.42)
for k in range(46):
    a[fy + k, 0:W] *= 1 - 0.38 * (1 - k / 46) ** 1.6
atlas = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
atlas.save(OUT + 'atlas2.png')

g = np.asarray(atlas.convert('L').filter(ImageFilter.GaussianBlur(1.4)), dtype=np.float32) / 255.0
dx, dy = np.gradient(g, axis=1) * 9.0, np.gradient(g, axis=0) * 9.0
n = np.dstack([-dx, dy, np.ones_like(g)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(OUT + 'normal2.png')

# Braided loop from the photo (vertical strip above the bead) -> turned so the braid runs along U
braid = P.crop((440, 595, 488, 742)).rotate(90, expand=True)
braid = ImageEnhance.Contrast(ImageEnhance.Brightness(ImageEnhance.Color(braid).enhance(1.6)).enhance(0.78)).enhance(1.25)
braid.resize((512, 128), Image.LANCZOS).save(OUT + 'braid.png')

# Shoulder strap: the same real braid as the toggle loop (fully braid, no background), a little darker
strap = P.crop((444, 598, 484, 740)).rotate(90, expand=True)
strap = ImageEnhance.Contrast(ImageEnhance.Brightness(ImageEnhance.Color(strap).enhance(1.45)).enhance(0.8)).enhance(1.2)
sa = np.asarray(strap, dtype=np.float32)
fade = 18
t = np.linspace(0, 1, fade)[None, :, None]
sa[:, :fade] = sa[:, :fade] * t + sa[:, -fade:] * (1 - t)
strap = Image.fromarray(np.clip(sa[:, :-fade], 0, 255).astype(np.uint8))
strap.resize((512, 128), Image.LANCZOS).save(OUT + 'strap.png')

# Wooden bead: light wood with soft rings (colour from the beads in the photo)
w, h = 512, 256
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
rings = np.sin(yy / h * np.pi * 10 + np.sin(xx / w * np.pi * 4) * 0.8) * 0.5 + 0.5
grain = soft_noise(w, h, 64, 0.03)
base = np.array([222, 204, 172], dtype=np.float32)       # sampled from the handle beads
wood = base[None, None, :] * (0.95 + rings[..., None] * 0.05) * grain[..., None]
Image.fromarray(np.clip(wood, 0, 255).astype(np.uint8)).save(OUT + 'wood.png')
print('textures ok')
