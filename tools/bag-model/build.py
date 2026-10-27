# 3D model of the boxy water-hyacinth bag (product 1): real size 22 x 18 x 8 cm.
# Soft woven body (rounded edges, slightly bulging sides), a raised lid flap with a lip,
# a braided toggle loop with a wooden bead button, and an arched handle of wooden beads on a cord.
import numpy as np, trimesh
from PIL import Image
from scipy.spatial import cKDTree

D = __import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/out/'
A = 2048.0
HX, HY, HZ, R = 0.11, 0.09, 0.04, 0.026          # half sizes (m) and edge radius
BULGE_Z, BULGE_X = 0.007, 0.004                    # soft woven sides bulge outwards

FACES = {   # origin, u axis, v axis (v runs DOWN the texture)
    'front':  ((-1,  1,  1), ( 2, 0, 0), (0, -2, 0)),
    'back':   (( 1,  1, -1), (-2, 0, 0), (0, -2, 0)),
    'top':    ((-1,  1, -1), ( 2, 0, 0), (0, 0,  2)),
    'bottom': ((-1, -1,  1), ( 2, 0, 0), (0, 0, -2)),
    'left':   ((-1,  1, -1), (0, 0,  2), (0, -2, 0)),
    'right':  (( 1,  1,  1), (0, 0, -2), (0, -2, 0)),
}
REG = {'front': (0, 0, 880, 720), 'back': (900, 0, 880, 720), 'top': (0, 740, 880, 320), 'bottom': (900, 740, 880, 320),
       'left': (0, 1080, 320, 720), 'right': (340, 1080, 320, 720), 'flap': (680, 1080, 880, 446), 'lip': (680, 1560, 880, 60)}

def surface(face, s, t, grow=0.0):
    """Point on the bag surface for face parameters s, t in [0, 1]. grow pushes it outwards (flap)."""
    o, u, v = (np.array(x, dtype=float) for x in FACES[face])
    half = np.array([HX, HY, HZ])
    p = (o + u * s + v * t) * half                    # point on the sharp box
    inner = half - R
    c = np.clip(p, -inner, inner)
    d = p - c
    L = np.linalg.norm(d)
    n = d / L if L > 1e-12 else np.cross(v, u) / np.linalg.norm(np.cross(v, u))
    q = c + n * (R + grow)
    fx = max(0.0, 1 - (q[0] / HX) ** 2); fy = max(0.0, 1 - (q[1] / HY) ** 2); fz = max(0.0, 1 - (q[2] / HZ) ** 2)
    q[2] += np.sign(q[2]) * BULGE_Z * fx * fy
    q[0] += np.sign(q[0]) * BULGE_X * fy * fz
    return q

def grid(face, s0, s1, t0, t1, n, m, region, grow=0.0):
    x0, y0, w, h = REG[region]
    V, UV, F = [], [], []
    for j in range(m + 1):
        for i in range(n + 1):
            s = s0 + (s1 - s0) * i / n; t = t0 + (t1 - t0) * j / m
            V.append(surface(face, s, t, grow))
            UV.append(((x0 + w * i / n) / A, 1 - (y0 + h * j / m) / A))
    for j in range(m):
        for i in range(n):
            a = j * (n + 1) + i
            F += [[a, a + n + 1, a + 1], [a + 1, a + n + 1, a + n + 2]]
    return np.array(V), np.array(UV), np.array(F)

def outward(V, F):
    """Turn every triangle so it faces away from the bag centre (the viewer hides back faces)."""
    centre = np.array([0.0, 0.0, 0.0])
    tri = V[F]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    flip = np.einsum('ij,ij->i', n, tri.mean(axis=1) - centre) < 0
    F = F.copy()
    F[flip] = F[flip][:, ::-1]
    return F

def smooth_normals(parts):
    """Normals that ignore the UV seams between faces (no hard lines along the rounded edges)."""
    allv = np.vstack([p[0] for p in parts])
    allf = np.vstack([p[2] + off for p, off in zip(parts, np.cumsum([0] + [len(p[0]) for p in parts[:-1]]))])
    allf = outward(allv, allf)
    welded = trimesh.Trimesh(allv, allf, process=True)          # merges duplicate positions
    _, idx = cKDTree(welded.vertices).query(allv)
    return allv, allf, welded.vertex_normals[idx]

def mesh(parts, image, normal=None, rough=0.9):
    V, F, N = smooth_normals(parts)
    UV = np.vstack([p[1] for p in parts])
    m = trimesh.Trimesh(V, F, vertex_normals=N, process=False)
    m.visual = trimesh.visual.TextureVisuals(uv=UV, material=trimesh.visual.material.PBRMaterial(
        baseColorTexture=image, normalTexture=normal, metallicFactor=0.0, roughnessFactor=rough))
    return m

atlas, normal = Image.open(D + 'atlas2.png'), Image.open(D + 'normal2.png')
N = 36
body = mesh([grid(f, 0, 1, 0, 1, N, N, f) for f in FACES], atlas, normal)

# Lid flap: covers the front half of the top and the top 42 % of the front, raised 5 mm, with a lip all round
G, FLAP_T, SIDE = 0.008, 0.42, 0.03
flap_top = grid('top', SIDE, 1 - SIDE, 0.45, 1.0, 30, 10, 'flap', G)
flap_front = grid('front', SIDE, 1 - SIDE, 0.0, FLAP_T, 30, 16, 'flap', G)
flap_front_uv = flap_front[1].copy()
flap_front_uv[:, 1] -= 0.0            # same region, the lid reads as one piece of weave
flap = mesh([flap_top, (flap_front[0], flap_front_uv, flap_front[2])], atlas, normal, 0.92)

# Lip: closes the gap between the flap and the body along the flap's edges (bottom, left, right)
def lip_strip(points_out, points_in):
    x0, y0, w, h = REG['lip']
    V, UV, F = [], [], []
    n = len(points_out)
    for i, (a, b) in enumerate(zip(points_out, points_in)):
        V += [a, b]; UV += [((x0 + w * i / (n - 1)) / A, 1 - y0 / A), ((x0 + w * i / (n - 1)) / A, 1 - (y0 + h) / A)]
    for i in range(n - 1):
        a = 2 * i
        F += [[a, a + 1, a + 2], [a + 2, a + 1, a + 3]]
    return np.array(V), np.array(UV), np.array(F)
edges = []
ss = np.linspace(SIDE, 1 - SIDE, 61)
edges.append(([surface('front', s, FLAP_T, G) for s in ss], [surface('front', s, FLAP_T, 0) for s in ss]))     # bottom edge
for s in (SIDE, 1 - SIDE):                                                                                       # left / right edges
    tf = np.linspace(FLAP_T, 0, 20); tt = np.linspace(1.0, 0.45, 14)
    out = [surface('front', s, t, G) for t in tf] + [surface('top', s, t, G) for t in tt]
    inn = [surface('front', s, t, 0) for t in tf] + [surface('top', s, t, 0) for t in tt]
    edges.append((out, inn))
edges.append(([surface('top', s, 0.45, G) for s in ss], [surface('top', s, 0.45, 0) for s in ss]))           # back edge on top
lip = mesh([lip_strip(o, i) for o, i in edges], atlas, None, 0.95)
# lips are thin strips: show both sides
lip.faces = np.vstack([lip.faces, lip.faces[:, ::-1]])

# Braided toggle loop: a flat braid from the flap edge down to the wooden bead
braid_img = Image.open(D + 'braid.png')
def tube(path, radius, flat, image, u_repeat):
    path = np.array(path); rings = 14
    V, UV, F = [], [], []
    total = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
    for k, p in enumerate(path):
        t = path[min(k + 1, len(path) - 1)] - path[max(k - 1, 0)]; t /= np.linalg.norm(t)
        side = np.cross(t, [0, 0, 1.0]); side /= np.linalg.norm(side) if np.linalg.norm(side) > 1e-9 else 1
        up = np.cross(side, t)
        for r in range(rings + 1):
            a = 2 * np.pi * r / rings
            V.append(p + side * np.cos(a) * radius + up * np.sin(a) * radius * flat)
            UV.append((total[k] / total[-1] * u_repeat, r / rings))
    for k in range(len(path) - 1):
        for r in range(rings):
            a = k * (rings + 1) + r; b = a + rings + 1
            F += [[a, b, a + 1], [a + 1, b, b + 1]]
    V, F = np.array(V), np.array(F)
    centre_line = np.repeat(path, rings + 1, axis=0)
    tri = V[F]
    nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    flip = np.einsum('ij,ij->i', nrm, tri.mean(axis=1) - centre_line[F[:, 0]]) < 0
    F[flip] = F[flip][:, ::-1]
    m = trimesh.Trimesh(V, F, process=False)
    m.visual = trimesh.visual.TextureVisuals(uv=np.array(UV), material=trimesh.visual.material.PBRMaterial(
        baseColorTexture=image, metallicFactor=0.0, roughnessFactor=0.9))
    return m
y_top = HY - (2 * HY) * FLAP_T                       # flap bottom edge (front)
z_front = HZ + BULGE_Z
bead_y = y_top - 0.045
loop_path = [[0, y_top + 0.025 - (0.025 + 0.045) * f,
              (z_front + G + 0.004) if y_top + 0.025 - 0.07 * f > y_top else (z_front + 0.006 + 0.003 * np.sin(np.pi * f))]
             for f in np.linspace(0, 1, 30)]
loop = tube(loop_path, 0.0095, 0.42, braid_img, 2.5)   # flat braided strap, 1.9 cm wide

# Wooden beads (button and handle)
wood_img = Image.open(D + 'wood.png')
def bead(radius, pos):
    s = trimesh.creation.uv_sphere(radius=radius, count=[24, 32])
    n = s.vertices / radius
    uv = np.c_[np.arctan2(n[:, 2], n[:, 0]) / (2 * np.pi) + 0.5, np.arcsin(np.clip(n[:, 1], -1, 1)) / np.pi + 0.5]
    s.visual = trimesh.visual.TextureVisuals(uv=uv, material=trimesh.visual.material.PBRMaterial(
        baseColorTexture=wood_img, metallicFactor=0.0, roughnessFactor=0.45))
    s.apply_translation(pos)
    return s
button = bead(0.0145, [0, bead_y, z_front + 0.012])

# Handle: 12 beads on an arch, a cord through them, ends tied into the top of the lid
arch = lambda a: np.array([-0.072 * np.cos(a), HY + G + 0.018 + 0.095 * np.sin(a), 0.0])
handle = [bead(0.0165, arch(a)) for a in np.linspace(0.11 * np.pi, 0.89 * np.pi, 9)]   # 9 beads, as in the photo
cord_path = [np.array([-0.072, HY - 0.004, 0.0])] + [arch(a) for a in np.linspace(0.0, np.pi, 48)] + [np.array([0.072, HY - 0.004, 0.0])]
cord = tube(cord_path, 0.0028, 1.0, braid_img, 20.0)

# Shoulder strap: a 1.6 cm braided rope fixed to both sides near the top, rising in an arch over the bead handle
from scipy.interpolate import CubicSpline
strap_img = Image.open(D + 'strap.png')
SX = HX + BULGE_X + 0.006                     # just outside the side wall
ctrl = np.array([
    [-SX, HY - 0.050, 0], [-SX, HY - 0.012, 0], [-SX - 0.006, HY + 0.06, 0], [-0.105, HY + 0.20, 0],
    [-0.060, HY + 0.30, 0], [0.0, HY + 0.335, 0],
    [0.060, HY + 0.30, 0], [0.105, HY + 0.20, 0], [SX + 0.006, HY + 0.06, 0], [SX, HY - 0.012, 0], [SX, HY - 0.050, 0]])
dist = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(ctrl, axis=0), axis=1))])
spline = CubicSpline(dist, ctrl, axis=0)
strap_path = spline(np.linspace(0, dist[-1], 160))
strap_len = dist[-1]
strap = tube(strap_path, 0.008, 0.8, strap_img, strap_len / 0.075)   # one braid repeat every ~7.5 cm
# where the strap meets the bag: a short wrapped collar on each side
collars = [tube([[s * (SX - 0.0005), HY - 0.044 + k * 0.004, 0] for k in range(7)], 0.0105, 0.85, strap_img, 0.25) for s in (-1, 1)]

scene = trimesh.Scene()
for name, g in [('bag_body', body), ('bag_flap', flap), ('bag_flap_lip', lip), ('toggle_loop', loop), ('button_bead', button), ('handle_cord', cord), ('shoulder_strap', strap), ('strap_collar_left', collars[0]), ('strap_collar_right', collars[1])]:
    scene.add_geometry(g, name)
for i, b in enumerate(handle):
    scene.add_geometry(b, f'handle_bead_{i}')
for g in scene.geometry.values():
    g.apply_translation([0, HY, 0])                     # stands on the floor
scene.export(D + 'bag-v2.glb')
print('exported', scene.bounds.round(3).tolist())
