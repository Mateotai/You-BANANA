"""Recorta las poses de la hoja de personaje 2D y las prepara para animar.

Para cada pose genera:
  - una capa de color (PNG con transparencia), sin las líneas negras ni la cara,
    y recoloreada para cada color de plátano (amarillo, verde, rosa, azul, morado);
  - las líneas negras en VECTOR (se ven nítidas a cualquier tamaño);
  - la posición de los ojos y la boca (para dibujarlos aparte: parpadeo, U invertida).

Uso: python3 scripts/sprites_from_sheet.py   (lee assets/sheet/poses-2d.png)
Salida: assets/sprites/*.png y src/sprites-data.js
Necesita opencv-python-headless y numpy.
"""
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SHEET = cv2.imread(str(ROOT / 'assets/sheet/poses-2d.png'))
OUT = ROOT / 'assets/sprites'
OUT.mkdir(parents=True, exist_ok=True)
UP = 2  # la capa de color se guarda al doble de tamaño (suave al ampliar)

# paneles de la hoja (x0, y0, x1, y1) y qué pose es cada figura (de izquierda a derecha)
PANELS = [
    ((8, 8, 356, 358), ['front']),
    ((363, 8, 718, 358), ['q34']),
    ((725, 8, 1080, 358), ['side']),
    ((1087, 8, 1440, 358), ['back']),
    ((8, 365, 356, 708), ['front2']),
    ((363, 365, 718, 708), ['walk1']),
    ((725, 365, 1080, 708), ['walk2']),
    ((1087, 365, 1440, 708), ['walk3']),
    ((8, 715, 356, 1077), ['slump']),
    ((363, 715, 697, 1077), ['sit', 'phone']),
    ((703, 715, 1093, 1077), ['call', 'greenwalk']),
    ((1100, 715, 1440, 1077), ['hug']),
]

PALETTES = {
    'yellow': None,
    'green': (180, 217, 95),
    'pink': (255, 164, 199),
    'blue': (140, 210, 255),
    'purple': (196, 165, 255),
}
BASE_YELLOW = (254, 215, 16)


def fill_holes(m):
    m = m.astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros_like(m)
    cv2.drawContours(out, cnts, -1, 1, -1)
    return out.astype(bool)


def figures(panel):
    """Separa las figuras del fondo liso."""
    hsv = cv2.cvtColor(panel, cv2.COLOR_BGR2HSV).astype(int)
    mx = panel.max(2).astype(int)
    fig = (hsv[..., 1] > 70) | (mx < 120)
    fig = cv2.morphologyEx(fig.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(bool)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fig.astype(np.uint8), 8)
    comps = [i for i in range(1, n) if st[i, 4] > 1500]
    comps.sort(key=lambda i: st[i, 0])  # de izquierda a derecha
    return [fill_holes(lab == i) for i in comps]


def recolor(rgb, mask, target):
    if target is None:
        return rgb
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    th = cv2.cvtColor(np.uint8([[target]]), cv2.COLOR_RGB2HSV)[0, 0].astype(np.float32)
    bh = cv2.cvtColor(np.uint8([[BASE_YELLOW]]), cv2.COLOR_RGB2HSV)[0, 0].astype(np.float32)
    yellow = mask & (hsv[..., 0] >= 17) & (hsv[..., 0] <= 40) & (hsv[..., 1] > 60)
    h = hsv[..., 0].copy(); s = hsv[..., 1].copy(); v = hsv[..., 2].copy()
    dh = th[0] - bh[0]
    h[yellow] = (h[yellow] + dh) % 180
    s[yellow] = np.clip(s[yellow] * (th[1] / bh[1]), 0, 255)
    v[yellow] = np.clip(v[yellow] * (th[2] / bh[2]), 0, 255)
    out = cv2.cvtColor(np.dstack([h, s, v]).astype(np.uint8), cv2.COLOR_HSV2RGB)
    return out


def trace(mask_soft, x0, y0, k=4, eps=0.9):
    """Contornos vectoriales (con agujeros) de una máscara suave."""
    big = cv2.resize(mask_soft.astype(np.float32), None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
    bin_ = (big > 0.38).astype(np.uint8)
    cnts, _ = cv2.findContours(bin_, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    paths = []
    for c in cnts:
        if cv2.contourArea(c) < 6 * k * k:
            continue
        c = cv2.approxPolyDP(c, eps, True)[:, 0, :].astype(np.float32) / k
        paths.append([round(float(v), 2) for p in c for v in (p[0] - x0, p[1] - y0)])
    return paths


from skimage.morphology import reconstruction, skeletonize

K = 4  # trabajamos a 4x para tener líneas suaves


def smooth_poly(P, sigma, closed):
    if len(P) < 3:
        return P
    k = int(3 * sigma) + 1
    ker = cv2.getGaussianKernel(2 * k + 1, sigma).ravel()
    if closed:
        pad = np.concatenate([P[-k:], P, P[:k]])
    else:
        pad = np.concatenate([np.repeat(P[:1], k, 0), P, np.repeat(P[-1:], k, 0)])
    out = np.stack([np.convolve(pad[:, j], ker, 'valid') for j in range(P.shape[1])], 1)
    if not closed:
        out[0], out[-1] = P[0], P[-1]
    return out


def silhouette(mask):
    """Contorno exterior suavizado (coordenadas del dibujo)."""
    big = cv2.resize(mask.astype(np.float32), None, fx=K, fy=K, interpolation=cv2.INTER_LINEAR)
    big = cv2.GaussianBlur(big, (0, 0), 2.0) > 0.5
    cnts, hier = cv2.findContours(big.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c, h in zip(cnts, hier[0] if hier is not None else []):
        hole = h[3] != -1
        if cv2.contourArea(c) < (12 if hole else 400) * K * K:
            continue
        P = smooth_poly(c[:, 0, :].astype(np.float32), 3.0, True)
        P = cv2.approxPolyDP(np.ascontiguousarray(P, dtype=np.float32).reshape(-1, 1, 2), 0.6, True)[:, 0, :] / K
        out.append([round(float(v), 2) for q in P for v in q])
    return out, big


def disk(r):
    r = max(1, int(round(r)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def clean(m, min_area):
    """Quita manchitas y rellena agujeritos (a escala 4x)."""
    m = m.astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.isin(lab, [i for i in range(1, n) if st[i, 4] >= min_area])
    inv = (~keep).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    small = np.isin(lab, [i for i in range(1, n) if st[i, 4] < min_area])
    return keep | small


def vec_regions(m, sigma=2.5, eps=0.5):
    """Contornos (con agujeros) de una máscara a escala 4x -> coordenadas del dibujo."""
    m = cv2.GaussianBlur(m.astype(np.float32), (0, 0), sigma) > 0.5
    cnts, hier = cv2.findContours(m.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cnts:
        if len(c) < 8 or cv2.contourArea(c) < 6 * K * K:
            continue
        P = smooth_poly(c[:, 0, :].astype(np.float32), 2.0, True)
        P = cv2.approxPolyDP(np.ascontiguousarray(P, dtype=np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :] / K
        out.append([round(float(v), 2) for q in P for v in q])
    return out


# colores medidos en la hoja
STEM3 = [(183, 103, 56), (128, 64, 28), (76, 39, 13)]  # cara de arriba, cara de delante, lado oscuro
SHADE_L = 197.0  # luminancia por debajo de la cual es sombra


def centerlines(ink_soft, sil_big, W0):
    """Líneas interiores: eje central del trazo, sin las que van por el borde exterior."""
    big = cv2.resize(ink_soft.astype(np.float32), None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), 1.2) > 0.35
    sk = skeletonize(big)
    # fuera lo que está pegado al borde (eso ya lo dibuja el contorno exterior)
    din = cv2.distanceTransform(sil_big.astype(np.uint8), cv2.DIST_L2, 5)
    sk &= din > 0.95 * W0 * K
    dist = cv2.distanceTransform(big.astype(np.uint8), cv2.DIST_L2, 5)
    ys, xs = np.nonzero(sk)
    S = set(zip(ys.tolist(), xs.tolist()))
    nb = lambda p: [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (p[0] + dy, p[1] + dx) in S]
    deg = {p: len(nb(p)) for p in S}
    seen = set()
    lines = []
    def walk(a, b):
        path = [a, b]; seen.add((a, b)); seen.add((b, a))
        while deg[path[-1]] == 2:
            nxt = [q for q in nb(path[-1]) if q != path[-2]]
            if not nxt or (path[-1], nxt[0]) in seen:
                break
            seen.add((path[-1], nxt[0])); seen.add((nxt[0], path[-1]))
            path.append(nxt[0])
        return path
    for p in S:
        if deg[p] != 2:
            for q in nb(p):
                if (p, q) not in seen:
                    lines.append(walk(p, q))
    for p in S:  # bucles cerrados
        if deg[p] == 2 and not any((p, q) in seen for q in nb(p)):
            lines.append(walk(p, nb(p)[0]))
    out = []
    for L in lines:
        if len(L) < 6 * K:  # trocitos sueltos fuera
            continue
        P = np.array([[x, y] for y, x in L], np.float32)
        w = np.array([dist[y, x] * 2 / K for y, x in L], np.float32)
        P = smooth_poly(P, 3.0, False)
        w = smooth_poly(w[:, None], 4.0, False)[:, 0]
        # extremos libres (sin unir a nada) -> se afinan como en el dibujo
        free0, free1 = deg[L[0]] == 1, deg[L[-1]] == 1
        idx = list(range(0, len(P), 3)) + [len(P) - 1]
        pts, ws = [], []
        for i in sorted(set(idx)):
            ww = min(1.0, w[i] / W0)
            if not (free0 and i < len(P) * 0.5) and not (free1 and i >= len(P) * 0.5):
                ww = 1.0
            ww = max(0.25, ww)
            pts += [round(float(P[i][0]) / K, 2), round(float(P[i][1]) / K, 2)]
            ws.append(round(float(ww), 2))
        out.append({'p': pts, 'w': ws})
    return out


data = {'poses': {}}
for (x0, y0, x1, y1), names in PANELS:
    panel = SHEET[y0:y1, x0:x1]
    figs = figures(panel)
    assert len(figs) >= len(names), (names, len(figs))
    # si hay más componentes de los esperados, nos quedamos con los más grandes
    figs = sorted(sorted(figs, key=lambda m: -m.sum())[:len(names)], key=lambda m: np.nonzero(m)[1].min())
    for name, m in zip(names, figs):
        ys, xs = np.nonzero(m)
        pad = 6
        bx0, by0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
        bx1, by1 = min(panel.shape[1], xs.max() + pad + 1), min(panel.shape[0], ys.max() + pad + 1)
        crop = panel[by0:by1, bx0:bx1]
        mask = m[by0:by1, bx0:bx1]
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        mx = crop.max(2).astype(np.float32)
        ink_soft = np.clip((125 - mx) / 70, 0, 1) * mask  # líneas negras (con antialias)
        ink = ink_soft > 0.35
        # rasgos de la cara: manchas negras sueltas dentro del cuerpo
        inner = cv2.erode(mask.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
        n, lab, st, cen = cv2.connectedComponentsWithStats(ink.astype(np.uint8), 8)
        feats = []
        for i in range(1, n):
            comp = lab == i
            if st[i, 4] < 12 or st[i, 4] > 500:
                continue
            if (comp & ~inner).any():
                continue
            feats.append((i, st[i, 4], cen[i]))
        face = None
        face_mask = np.zeros_like(mask)
        if name not in ('phone',) and len(feats) >= 3:
            # dos ojos (manchas redondas parecidas, a la misma altura) y una boca alargada debajo
            info = {}
            for i, area, c in feats:
                yy, xx = np.nonzero(lab == i)
                pts = np.stack([xx, yy], 1).astype(np.float32)
                ev = np.linalg.eigvalsh(np.cov(pts.T)) if len(pts) > 2 else np.array([1.0, 1.0])
                info[i] = (area, c, ev[1] / max(ev[0], 0.05))
            best = None
            ids = list(info)
            for ai in range(len(ids)):
                for bi in range(ai + 1, len(ids)):
                    e1, e2 = info[ids[ai]], info[ids[bi]]
                    dx, dy = abs(e1[1][0] - e2[1][0]), abs(e1[1][1] - e2[1][1])
                    if not (14 < dx < 50 and dy < 14 and e1[2] < 3 and e2[2] < 3 and 0.4 < e1[0] / e2[0] < 2.5):
                        continue
                    ex, ey = (e1[1][0] + e2[1][0]) / 2, (e1[1][1] + e2[1][1]) / 2
                    for mi in ids:
                        if mi in (ids[ai], ids[bi]):
                            continue
                        m_ = info[mi]
                        ddy = m_[1][1] - ey
                        if not (5 < ddy < 28 and abs(m_[1][0] - ex) < 22 and m_[2] > 2.5):
                            continue
                        score = abs(ddy - 14) + abs(m_[1][0] - ex) + dy
                        if best is None or score < best[0]:
                            best = (score, mi, ids[ai], ids[bi])
            if best:
                mouth = (best[1], info[best[1]][0], info[best[1]][1])
                eyes = [(i, info[i][0], info[i][1]) for i in best[2:]]
                yy, xx = np.nonzero(lab == mouth[0])
                pts = np.stack([xx, yy], 1).astype(np.float32)
                mc = pts.mean(0)
                ev, evec = np.linalg.eigh(np.cov(pts.T))
                ax = evec[:, 1]
                if ax[0] < 0:
                    ax = -ax
                proj = (pts - mc) @ ax
                thick = max(2.5, 4 * np.sqrt(ev[0]))
                a = mc + ax * (proj.min() + thick / 2)
                b = mc + ax * (proj.max() - thick / 2)
                face = {
                    'eyes': sorted([[round(float(e[2][0]), 2), round(float(e[2][1]), 2), round(float(np.sqrt(e[1] / np.pi)), 2)] for e in eyes]),
                    'mouth': {'a': [round(float(a[0]), 2), round(float(a[1]), 2)], 'b': [round(float(b[0]), 2), round(float(b[1]), 2)], 'w': round(float(thick), 2)},
                }
                for f in [mouth] + eyes:
                    face_mask |= lab == f[0]
        # capa de color: quitamos líneas y cara rellenando con el color de alrededor
        hsv_r = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV).astype(int)
        stem_r = (hsv_r[..., 0] <= 17) & (hsv_r[..., 1] > 90) & (hsv_r[..., 2] > 50)
        # sólo el tallo de verdad (la mancha marrón grande), no los bordes oscuros de las líneas
        nbs, lbs, sbs, _ = cv2.connectedComponentsWithStats(stem_r.astype(np.uint8), 8)
        stem_r = (lbs == (1 + np.argmax(sbs[1:, 4]))) if nbs > 1 and name != 'phone' else np.zeros_like(stem_r)
        stem_r = fill_holes(stem_r)
        stem_r = cv2.dilate(stem_r.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~(mx < 60)
        remove = cv2.dilate((((ink_soft > 0.04) & ~stem_r) | face_mask).astype(np.uint8), np.ones((5, 5), np.uint8))
        if name == 'phone':
            remove[:] = 0
        fill = cv2.inpaint(rgb, remove, 6, cv2.INPAINT_TELEA)
        alpha = cv2.erode(mask.astype(np.uint8), np.ones((3, 3), np.uint8)) * 255
        # tinta vectorial (sin la cara)
        ink_vec = ink_soft * (1 - cv2.dilate(face_mask.astype(np.uint8), np.ones((5, 5), np.uint8)))
        # quitamos trocitos sueltos de línea (donde el dibujo difumina el trazo)
        nn, ll, ss, _ = cv2.connectedComponentsWithStats((ink_vec > 0.38).astype(np.uint8), 8)
        for i in range(1, nn):
            if ss[i, 4] < 45:
                ink_vec[ll == i] = 0
        ink_paths = []
        # zonas de fondo encerradas por la figura (p. ej. entre brazo y pierna): no se rellenan
        hsv_m = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV).astype(int)
        bgl = (mask & (hsv_m[..., 1] < 45) & (hsv_m[..., 2] > 170)).astype(np.uint8)
        nh, lh, sh_, _ = cv2.connectedComponentsWithStats(bgl, 4)
        holes = np.isin(lh, [i for i in range(1, nh) if sh_[i, 4] > 15])
        sil, sil_big = silhouette(mask & ~holes)
        vec = None
        if name not in ('phone', 'greenwalk'):
            fb = cv2.resize(fill.astype(np.float32), None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC)
            Lb = cv2.GaussianBlur(fb @ np.float32([0.299, 0.587, 0.114]), (0, 0), 12.0)
            stem_big = cv2.resize(stem_r.astype(np.float32), None, fx=K, fy=K, interpolation=cv2.INTER_LINEAR) > 0.5
            stem_big &= sil_big
            # sombra del lado de atrás y debajo de brazos y piernas
            # umbral con histéresis: la sombra crece desde las zonas claramente oscuras (sin manchitas)
            body_r = sil_big & ~stem_big
            seed = body_r & (Lb < SHADE_L - 5)
            grow = body_r & (Lb < SHADE_L + 1)
            shade = reconstruction(seed.astype(np.uint8), grow.astype(np.uint8), method='dilation').astype(np.uint8)
            shade = cv2.morphologyEx(shade, cv2.MORPH_OPEN, disk(1.5 * K))
            shade = cv2.morphologyEx(shade, cv2.MORPH_CLOSE, disk(1.5 * K))
            shade = clean(shade.astype(bool), 20 * K * K)
            shade_ext = shade | (cv2.dilate(shade.astype(np.uint8), disk(3 * K)).astype(bool) & ~sil_big)
            shade_paths = vec_regions(shade_ext, 4.0)
            # caras del tallo: cada píxel al color de tallo más parecido
            fbs = cv2.GaussianBlur(fb, (0, 0), 2.0)
            d = np.stack([((fbs - np.float32(c)) ** 2).sum(2) for c in STEM3], 0)
            cls = np.argmin(d, 0)
            stem_all = vec_regions(stem_big, 1.5)
            facets = []
            for ci in (2, 0):  # lado oscuro y cara de arriba (encima del tono medio)
                fm = clean(stem_big & (cls == ci), 10 * K * K)
                facets.append({'c': ci, 'p': vec_regions(fm, 1.5)})
            vec = {'shade': shade_paths, 'stem': stem_all, 'facets': facets}
        elif name == 'phone':
            # el móvil: 4 tonos de gris
            fb = cv2.resize(rgb.astype(np.float32), None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC)
            mb = cv2.resize(mask.astype(np.float32), None, fx=K, fy=K, interpolation=cv2.INTER_LINEAR) > 0.5
            px = fb[mb].reshape(-1, 3)
            crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.5)
            _, lbl, ctr = cv2.kmeans(px, 4, None, crit, 3, cv2.KMEANS_PP_CENTERS)
            full = np.full(mb.shape, -1, np.int32); full[mb] = lbl.ravel()
            full = cv2.medianBlur(full.astype(np.uint8) + 1, 5).astype(np.int32) - 1
            order = np.argsort(ctr @ [0.299, 0.587, 0.114])
            tones = [{'col': '#%02x%02x%02x' % tuple(int(v) for v in ctr[order[0]]), 'p': vec_regions(mb, 1.5)}]
            for ci in order[1:]:
                tones.append({'col': '#%02x%02x%02x' % tuple(int(v) for v in ctr[ci]), 'p': vec_regions(clean(full == ci, 6 * K * K), 1.5)})
            vec = {'tones': tones}
        W0 = 3.4  # grosor de línea de la hoja (medido: mediana 3,3 px), en px del dibujo
        lines = [] if name == 'phone' else centerlines(ink_vec, sil_big, W0)
        # apoyo: en x, el centro del tallo (así la cabeza no salta al cambiar de pose); en y, el suelo
        ys2, xs2 = np.nonzero(mask)
        hsv_c = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV).astype(int)
        brown = mask & (hsv_c[..., 0] <= 16) & (hsv_c[..., 1] > 90) & (hsv_c[..., 2] > 50)
        nb, labb, stb, cenb = cv2.connectedComponentsWithStats(brown.astype(np.uint8), 8)
        if nb > 1 and name != 'phone':
            ib = 1 + np.argmax(stb[1:, 4])
            ax_ = float(cenb[ib][0]); stem_size = float(np.sqrt(stb[ib, 4]))
        else:
            low = ys2 >= ys2.max() - 3
            ax_ = float(xs2[low].mean()); stem_size = None
        anchor = [round(ax_, 2), float(ys2.max())]
        entry = {'w': int(crop.shape[1]), 'h': int(crop.shape[0]), 'anchor': anchor, 'ink': ink_paths, 'sil': [] if name == 'phone' else sil, 'lines': lines, 'lw': W0, 'face': face, 'vec': vec, 'img': {}}
        pals = {'yellow': None} if name in ('phone', 'greenwalk') else PALETTES
        for pal, target in pals.items():
            col = recolor(fill, mask, target)
            big = cv2.resize(np.dstack([col, alpha]), None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
            f = OUT / f'{name}_{pal}.png'
            cv2.imwrite(str(f), cv2.cvtColor(big, cv2.COLOR_RGBA2BGRA))
            entry['img'][pal] = f'../assets/sprites/{f.name}'
        entry['up'] = UP
        # escala para que todas las poses tengan el mismo tamaño (la hoja dibuja algunas más pequeñas)
        NORM = {'front': 1.0, 'q34': 1.0, 'side': 1.0, 'back': 1.0, 'front2': 1.033, 'walk1': 1.036, 'walk2': 1.036, 'walk3': 1.036,
                'slump': 0.935, 'sit': 0.957, 'call': 1.13, 'hug': 0.917, 'greenwalk': 1.3, 'phone': 1.0}
        entry['norm'] = NORM.get(name, 1.0)
        data['poses'][name] = entry
        print(f'{name:10s} {crop.shape[1]}x{crop.shape[0]} líneas={len(lines)} cara={"sí" if face else "no"}')

base_c, shade_c = (254, 215, 16), (252, 194, 9)  # medidos en la hoja
pal_out = {'yellow': {'base': '#%02x%02x%02x' % base_c, 'shade': '#%02x%02x%02x' % shade_c}}
for pal, target in PALETTES.items():
    if target is None:
        continue
    # sombra: algo más oscura y saturada (como la del amarillo)
    h, sat, v = cv2.cvtColor(np.uint8([[target]]), cv2.COLOR_RGB2HSV)[0, 0].astype(float)
    sh = cv2.cvtColor(np.uint8([[[h, min(255, sat * 1.18 + 8), v * 0.93]]]), cv2.COLOR_HSV2RGB)[0, 0]
    pal_out[pal] = {'base': '#%02x%02x%02x' % tuple(target), 'shade': '#%02x%02x%02x' % tuple(int(x) for x in sh)}
data['palettes'] = pal_out
data['stem'] = ['#%02x%02x%02x' % c for c in STEM3]
print('paletas', pal_out)

(ROOT / 'src/sprites-data.js').write_text(
    '// Generado por scripts/sprites_from_sheet.py a partir de assets/sheet/poses-2d.png\n'
    'export const SPRITES = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print('ok')
