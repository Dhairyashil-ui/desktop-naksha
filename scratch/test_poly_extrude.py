import numpy as np
import trimesh

def triangulate_2d_polygon(poly_coords):
    """Pure Python ear clipping triangulation for 2D simple polygon."""
    pts = np.array(poly_coords, dtype=np.float64)
    n = len(pts)
    if n < 3:
        return np.array([]), np.array([])
    
    # Ensure CCW order
    def area2(p):
        return 0.5 * np.sum(p[:, 0] * np.roll(p[:, 1], 1) - p[:, 1] * np.roll(p[:, 0], 1))
    
    if area2(pts) < 0:
        pts = pts[::-1]
    
    def is_convex(p0, p1, p2):
        return (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) > 1e-7

    def in_triangle(pt, a, b, c):
        def sign(p1, p2, p3):
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
        d1 = sign(pt, a, b)
        d2 = sign(pt, b, c)
        d3 = sign(pt, c, a)
        has_neg = (d1 < -1e-7) or (d2 < -1e-7) or (d3 < -1e-7)
        has_pos = (d1 > 1e-7) or (d2 > 1e-7) or (d3 > 1e-7)
        return not (has_neg and has_pos)

    indices = list(range(n))
    triangles = []
    
    limit = n * 4
    count = 0
    while len(indices) > 3 and count < limit:
        count += 1
        ear_found = False
        m = len(indices)
        for i in range(m):
            prev_idx = indices[(i - 1) % m]
            curr_idx = indices[i]
            next_idx = indices[(i + 1) % m]
            
            p_prev = pts[prev_idx]
            p_curr = pts[curr_idx]
            p_next = pts[next_idx]
            
            if not is_convex(p_prev, p_curr, p_next):
                continue
                
            has_inside = False
            for j in range(m):
                if j in ((i - 1) % m, i, (i + 1) % m):
                    continue
                if in_triangle(pts[indices[j]], p_prev, p_curr, p_next):
                    has_inside = True
                    break
                    
            if not has_inside:
                triangles.append([prev_idx, curr_idx, next_idx])
                indices.pop(i)
                ear_found = True
                break
                
        if not ear_found:
            triangles.append([indices[0], indices[1], indices[2]])
            indices.pop(1)
            
    triangles.append([indices[0], indices[1], indices[2]])
    return pts, np.array(triangles)

def extrude_prism(poly_coords, min_z, max_z):
    pts_2d, tris_2d = triangulate_2d_polygon(poly_coords)
    n = len(pts_2d)
    
    v_bottom = np.column_stack((pts_2d, np.full(n, min_z)))
    v_top = np.column_stack((pts_2d, np.full(n, max_z)))
    vertices = np.vstack((v_bottom, v_top))
    
    faces = []
    for t in tris_2d:
        faces.append([t[0], t[2], t[1]]) # Bottom reversed
        
    for t in tris_2d:
        faces.append([n + t[0], n + t[1], n + t[2]]) # Top
        
    for i in range(n):
        nxt = (i + 1) % n
        faces.append([i, nxt, n + nxt])
        faces.append([i, n + nxt, n + i])
        
    mesh = trimesh.Trimesh(vertices=vertices, faces=np.array(faces), process=True)
    return mesh

coords = [(0, 0), (6, 0), (6, 4), (4, 4), (4, 8), (0, 8)]
m = extrude_prism(coords, 540.0, 543.65)
print('Watertight:', m.is_watertight)
print('Volume:', m.volume)
print('Centroid:', m.centroid)
print('Faces:', len(m.faces))
glb_bytes = m.export(file_type='glb')
print('GLB export size:', len(glb_bytes), 'bytes')
