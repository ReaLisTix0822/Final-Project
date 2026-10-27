# Upright, clean and export a TripoSR OBJ (+ baked texture) as a Y-up GLB
import sys, numpy as np, trimesh
from PIL import Image
src, tex, dst = sys.argv[1:4]
flat = len(sys.argv) > 4 and sys.argv[4] == 'flat'  # coaster photographed from above: lie it on its widest face
m = trimesh.load(open(src, 'rb'), file_type='obj', process=False, force='mesh')
uv = m.visual.uv.copy()
# 1. Keep the biggest connected piece (drops floating bits from shadows / reflections)
w = m.copy(); w.merge_vertices(merge_tex=True, merge_norm=True)
labels = trimesh.graph.connected_component_labels(w.face_adjacency, node_count=len(w.faces))
keep = labels == np.bincount(labels).argmax()
print('faces kept', keep.sum(), 'of', len(keep))
m.update_faces(keep); m.remove_unreferenced_vertices()
# 2. Stand it on its base: the stable resting pose closest to the photo's "up" (Z)
w = m.copy(); w.merge_vertices(merge_tex=True, merge_norm=True)
poses, probs = trimesh.poses.compute_stable_poses(w, n_samples=1)
def up_score(T):  # how close the original +Z ends up to the new +Z
    return (T[:3, :3] @ np.array([0, 0, 1.0]))[2]
best = 0 if flat else max(range(len(poses)), key=lambda i: (up_score(poses[i]) > 0.6, probs[i]))
print('pose', best, 'prob', round(float(probs[best]), 3), 'up', round(float(up_score(poses[best])), 3))
m.apply_transform(poses[best])
# 3. glTF is Y-up; centre on the floor
m.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
b = m.bounds; m.apply_translation([-(b[0][0] + b[1][0]) / 2, -b[0][1], -(b[0][2] + b[1][2]) / 2])
mat = trimesh.visual.material.PBRMaterial(baseColorTexture=Image.open(tex), metallicFactor=0.0, roughnessFactor=0.8)
m.visual = trimesh.visual.TextureVisuals(uv=m.visual.uv, material=mat)
m.export(dst)
print('extents', m.extents.round(3))
