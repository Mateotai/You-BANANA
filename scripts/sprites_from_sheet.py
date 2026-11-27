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
        remove = cv2.dilate(((ink_soft > 0.15) | face_mask).astype(np.uint8), np.ones((3, 3), np.uint8))
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
        ink_paths = [] if name == 'phone' else trace(ink_vec, 0, 0)  # el móvil se deja tal cual (es gris oscuro, no línea)
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
        entry = {'w': int(crop.shape[1]), 'h': int(crop.shape[0]), 'anchor': anchor, 'ink': ink_paths, 'face': face, 'img': {}}
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
        print(f'{name:10s} {crop.shape[1]}x{crop.shape[0]} tinta={len(ink_paths)} cara={"sí" if face else "no"}')

(ROOT / 'src/sprites-data.js').write_text(
    '// Generado por scripts/sprites_from_sheet.py a partir de assets/sheet/poses-2d.png\n'
    'export const SPRITES = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print('ok')
