"""Calca el plátano de la foto de producto (vista 15/17, fondo blanco) y genera
las formas vectoriales que usa la versión 2D (src/banana2d-data.js).

Uso:
    python3 scripts/trace_reference.py ruta/a/la/foto.jpg

Qué hace:
  1. Separa la figura del fondo blanco (silueta exacta de la foto).
  2. Separa el tallo marrón y los rasgos negros de la cara.
  3. Reduce el amarillo a 3 tonos planos (sombra / base / luz), como una ilustración.
  4. Saca los pliegues reales (donde el brazo toca la pierna, entre las rodillas...).
  5. Mide ojos y boca para redibujarlos (así pueden parpadear y mirar).
Necesita: opencv-python-headless, numpy.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

SRC = sys.argv[1]
OUT = Path(__file__).resolve().parent.parent / 'src' / 'banana2d-data.js'

im = cv2.imread(SRC)
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(int)
H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
b, g, r = [im[..., i].astype(np.float32) for i in range(3)]
L = 0.299 * r + 0.587 * g + 0.114 * b
h, w = S.shape


def largest(mask):
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if n <= 1:
        return mask.astype(bool)
    return lab == (1 + np.argmax(st[1:, cv2.CC_STAT_AREA]))


def fill_holes(mask):
    m = mask.astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros_like(m)
    cv2.drawContours(out, cnts, -1, 1, -1)
    return out.astype(bool)


# 1. silueta (zona de la figura; se excluyen el logo y la regla de medidas)
roi = np.zeros((h, w), bool)
roi[95:1470, 150:930] = True
roi[:145, :440] = False
fig = ((S > 70) | (V < 110)) & roi
fig = fill_holes(largest(fig))
fig = cv2.morphologyEx(fig.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))).astype(bool)

# 2. tallo y cara
brown = fill_holes(largest(fig & (H <= 17) & (S > 120) & (V > 25)))
face = fig & ~brown & (V < 100)
yel = fig & ~brown

# quitamos la cara de la luminancia para que no ensucie el sombreado
Lf = cv2.inpaint(np.clip(L, 0, 255).astype(np.uint8), cv2.dilate(face.astype(np.uint8), np.ones((11, 11), np.uint8)), 9, cv2.INPAINT_TELEA).astype(np.float32)
Lf[~fig] = 255


def clean(m, minarea=900, s=3.0, inside=yel):
    m = (cv2.GaussianBlur(m.astype(np.float32), (0, 0), s) > 0.5) & inside
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    keep = np.isin(lab, [i for i in range(1, n) if st[i, 4] > minarea])
    inv = inside & ~keep
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv.astype(np.uint8), 8)
    keep |= np.isin(lab, [i for i in range(1, n) if st[i, 4] <= minarea])
    return keep


# 3. tonos planos
Ls = cv2.GaussianBlur(Lf, (0, 0), 6)
base = clean(Ls > 180)
light = clean(Ls > 207, 1500, 4)

# 4. pliegues (valles oscuros estrechos), sólo los alargados
Lb = cv2.GaussianBlur(Lf, (0, 0), 1.5)
bh = cv2.morphologyEx(Lb, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
crease = (bh > 9) & yel & ~cv2.dilate(face.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)
crease &= cv2.erode(fig.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
crease = cv2.GaussianBlur(crease.astype(np.float32), (0, 0), 2) > 0.45
n, lab, st, _ = cv2.connectedComponentsWithStats(crease.astype(np.uint8), 8)
keep = []
for i in range(1, n):
    if st[i, 4] < 250:
        continue
    ys, xs = np.nonzero(lab == i)
    pts = np.stack([xs, ys], 1).astype(np.float32)
    ev = np.linalg.eigvalsh(np.cov(pts.T))
    if ev[1] / max(ev[0], 1e-3) > 9:  # alargado
        keep.append(i)
crease = np.isin(lab, keep)

# tonos del tallo
stem_light = clean(brown & (V > 125), 300, 2, brown)
stem_dark = clean(brown & (V < 95), 300, 2, brown)

# 5. cara
n, lab, st, cent = cv2.connectedComponentsWithStats(face.astype(np.uint8), 8)
blobs = [(st[i, 4], i) for i in range(1, n) if st[i, 4] > 200]
blobs.sort(reverse=True)
mouth_i = blobs[0][1]
eye_is = [i for _, i in blobs[1:3]]
ys, xs = np.nonzero(lab == mouth_i)
pts = np.stack([xs, ys], 1).astype(np.float32)
mc = pts.mean(0)
evals, evecs = np.linalg.eigh(np.cov(pts.T))
axis = evecs[:, 1]
proj = (pts - mc) @ axis
thick = 4 * np.sqrt(evals[0])
p1 = mc + axis * (proj.min() + thick / 2)
p2 = mc + axis * (proj.max() - thick / 2)
eyes = sorted([(cent[i][0], cent[i][1], np.sqrt(st[i, 4] / np.pi)) for i in eye_is])

# ---- coordenadas locales: origen en el suelo bajo la figura, escala a ~790 px de alto
ys, xs = np.nonzero(fig)
OX, OY = 560.0, float(ys.max()) - 30
K = 790.0 / (ys.max() - ys.min())


def to_local(x, y):
    return [round((x - OX) * K, 1), round((y - OY) * K, 1)]


def vectorize(mask, eps=0.9, min_area=60, sigma=2.0):
    m = mask.astype(np.uint8)
    cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cnts:
        if cv2.contourArea(c) < min_area:
            continue
        c = c[:, 0, :].astype(np.float32)
        # suavizado a lo largo del contorno
        k = int(3 * sigma) + 1
        pad = np.concatenate([c[-k:], c, c[:k]])
        ker = cv2.getGaussianKernel(2 * k + 1, sigma).ravel()
        sm = np.stack([np.convolve(pad[:, j], ker, 'valid') for j in range(2)], 1)
        ap = cv2.approxPolyDP(np.ascontiguousarray(sm, dtype=np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :]
        out.append([v for p in ap for v in to_local(*p)])
    return out


data = {
    'scale': K,
    'silhouette': vectorize(fig, 0.8),
    'base': vectorize(base, 1.0, 60, 4.0),
    'light': vectorize(light, 1.0, 60, 5.0),
    'crease': vectorize(crease, 0.7, 30),
    'stem': vectorize(brown, 0.8),
    'stemLight': vectorize(stem_light),
    'stemDark': vectorize(stem_dark),
    'eyes': [to_local(x, y) + [round(rad * K, 2)] for x, y, rad in eyes],
    'mouth': {'a': to_local(*p1), 'b': to_local(*p2), 'width': round(thick * K, 2)},
}
OUT.write_text(
    '// Generado por scripts/trace_reference.py a partir de la foto de producto (vista 15/17).\n'
    '// Coordenadas locales: origen en el suelo, y negativa hacia arriba.\n'
    'export const TRACE = ' + json.dumps(data, separators=(',', ':')) + ';\n'
)
print('ok ->', OUT, {k: (len(v) if isinstance(v, list) else v) for k, v in data.items()})
