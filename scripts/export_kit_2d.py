"""Exporta el personaje 2D en VECTOR (SVG) para usarlo en cualquier programa
(CapCut, Premiere, After Effects, Figma, Canva, Illustrator...).

Genera personaje/2d/svg/<pose>_<color>_<cara>.svg a partir de src/sprites-data.js,
con exactamente el mismo dibujo que se usa en los videos.

Uso: python3 scripts/export_kit_2d.py
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'personaje/2d/svg'
OUT.mkdir(parents=True, exist_ok=True)

src = (ROOT / 'src/sprites-data.js').read_text()
D = json.loads(src[src.index('{'):src.rindex('}') + 1])

INK = '#0b0402'
SOFT = 1.3  # suavidad de la sombra (igual que en src/sprite-banana.js)
POSES = {
    'front': 'frente', 'front2': 'frente-2', 'q34': 'tres-cuartos', 'side': 'perfil', 'back': 'espalda',
    'walk1': 'caminar-1', 'walk2': 'caminar-2', 'walk3': 'caminar-3',
    'slump': 'cabizbajo', 'sit': 'sentado', 'call': 'llamando', 'hug': 'abrazando-rodillas',
}
COLORS = {'yellow': 'amarillo', 'green': 'verde', 'pink': 'rosa', 'blue': 'azul', 'purple': 'morado'}
FACES = {'normal': {}, 'u-invertida': {'frown': 1}, 'ojos-cerrados': {'blink': 1}}


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def simplify(a, eps=0.3):
    # quita puntos sobrantes del contorno (el archivo pesa menos y se ve igual)
    import numpy as np, cv2
    P = np.array(a, np.float32).reshape(-1, 1, 2)
    if len(P) < 8:
        return a
    Q = cv2.approxPolyDP(P, eps, True)[:, 0, :]
    return [float(v) for q in Q for v in q] if len(Q) >= 4 else a


def closed_d(a):
    a = simplify(a)
    n = len(a) // 2
    X = lambda i: a[((i + n) % n) * 2]
    Y = lambda i: a[((i + n) % n) * 2 + 1]
    d = [f'M{f((X(-1) + X(0)) / 2)} {f((Y(-1) + Y(0)) / 2)}']
    for i in range(n):
        d.append(f'Q{f(X(i))} {f(Y(i))} {f((X(i) + X(i + 1)) / 2)} {f((Y(i) + Y(i + 1)) / 2)}')
    return ''.join(d) + 'Z'


def open_d(a):
    n = len(a) // 2
    d = [f'M{f(a[0])} {f(a[1])}']
    for i in range(1, n - 1):
        d.append(f'Q{f(a[2 * i])} {f(a[2 * i + 1])} {f((a[2 * i] + a[2 * i + 2]) / 2)} {f((a[2 * i + 1] + a[2 * i + 3]) / 2)}')
    d.append(f'L{f(a[2 * n - 2])} {f(a[2 * n - 1])}')
    return ''.join(d)


def paths_d(lst):
    return ''.join(closed_d(c) for c in lst or [])


def face_svg(F, face):
    """Ojos y boca, con la misma fórmula que src/sprite-banana.js (drawFace)."""
    if not F:
        return ''
    out = []
    (x1, y1, r1), (x2, y2, r2) = F['eyes']
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
    r = max(r1, r2) * 1.02
    ry = max(0.6, r * (1 - face.get('blink', 0) * 0.9))
    for x, y in ((x1, y1), (x2, y2)):
        out.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r)}" ry="{f(ry)}" transform="rotate({f(ang)} {f(x)} {f(y)})" fill="{INK}"/>')
    a, b, w = F['mouth']['a'], F['mouth']['b'], F['mouth']['w']
    fr = face.get('frown', 0)
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    dx, dy = (b[0] - a[0]) / 2, (b[1] - a[1]) / 2
    ln = math.hypot(dx, dy)
    nx, ny = dy / ln, -dx / ln
    k = 1 - 0.18 * fr
    drop, rise = 2.6 * fr, 3.2 * fr
    p0 = (mx - dx * k - nx * drop, my - dy * k - ny * drop)
    c = (mx + nx * rise * 2, my + ny * rise * 2)
    p1 = (mx + dx * k - nx * drop, my + dy * k - ny * drop)
    out.append(f'<path d="M{f(p0[0])} {f(p0[1])}Q{f(c[0])} {f(c[1])} {f(p1[0])} {f(p1[1])}" fill="none" stroke="{INK}" '
               f'stroke-width="{f(w * 1.05)}" stroke-linecap="round"/>')
    return ''.join(out)


def pose_svg(name, pal, face):
    P = D['poses'][name]
    C = D['palettes'][pal]
    V = P['vec']
    lw = P['lw']
    w, h = P['w'], P['h']
    sil = paths_d(P['sil'])
    body = [
        f'<defs><clipPath id="s"><path d="{sil}" clip-rule="evenodd"/></clipPath>'
        f'<filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="{SOFT}"/></filter></defs>',
        f'<path d="{sil}" fill="{C["base"]}" fill-rule="evenodd"/>',
        '<g clip-path="url(#s)">',
        f'<path d="{paths_d(V["shade"])}" fill="{C["shade"]}" fill-rule="evenodd" filter="url(#b)"/>',
        f'<path d="{paths_d(V["stem"])}" fill="{D["stem"][1]}" fill-rule="evenodd"/>',
    ]
    for fc in V['facets']:
        body.append(f'<path d="{paths_d(fc["p"])}" fill="{D["stem"][fc["c"]]}" fill-rule="evenodd"/>')
    body.append(f'<path d="{sil}" fill="none" stroke="{INK}" stroke-width="{f(lw * 2)}" stroke-linejoin="round"/>')
    body.append('</g>')
    # líneas interiores (las que se afinan, por tramos)
    full = ''.join(open_d(L['p']) for L in P['lines'] if min(L['w']) > 0.99)
    if full:
        body.append(f'<path d="{full}" fill="none" stroke="{INK}" stroke-width="{f(lw)}" stroke-linecap="round" stroke-linejoin="round"/>')
    for L in P['lines']:
        if min(L['w']) > 0.99:
            continue
        # líneas que se afinan: tramos agrupados por grosor (de 0,1 en 0,1)
        p, ws = L['p'], L['w']
        run, cur = [], None
        def flush():
            if run:
                d = f'M{f(run[0][0])} {f(run[0][1])}' + ''.join(f'L{f(x)} {f(y)}' for x, y in run[1:])
                body.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{f(lw * cur)}" stroke-linecap="round" stroke-linejoin="round"/>')
        for i in range(1, len(ws)):
            wq = round((ws[i - 1] + ws[i]) / 2, 1)
            a0, a1 = (p[2 * i - 2], p[2 * i - 1]), (p[2 * i], p[2 * i + 1])
            if wq != cur:
                flush()
                run, cur = [a0], wq
            run.append(a1)
        flush()
    body.append(face_svg(P.get('face'), face))
    H = 1000  # tamaño de presentación (es vector: se puede escalar sin perder calidad)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{round(w * H / h)}" height="{H}">'
            + ''.join(body) + '</svg>\n')


def phone_svg():
    P = D['poses']['phone']
    body = [f'<path d="{paths_d(t["p"])}" fill="{t["col"]}" fill-rule="evenodd"/>' for t in P['vec']['tones']]
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {P["w"]} {P["h"]}" width="{P["w"] * 4}" height="{P["h"] * 4}">' + ''.join(body) + '</svg>\n'


n = 0
for pose, pname in POSES.items():
    has_face = bool(D['poses'][pose].get('face'))
    for pal, cname in COLORS.items():
        for fname, face in FACES.items():
            if not has_face and fname != 'normal':
                continue
            (OUT / f'{pname}_{cname}_{fname}.svg').write_text(pose_svg(pose, pal, face))
            n += 1
(OUT / 'movil.svg').write_text(phone_svg())
print(f'{n + 1} SVG ->', OUT)
