# Kit del personaje: el plátano de You-BANANA

Todo lo que hace falta para usar al plátano en vídeos: imágenes listas para cualquier editor,
clips animados y el código para generar animaciones nuevas.

Es un plátano de **cara de póker**. Solo tiene estas caras: normal, **boca en U invertida** y ojos cerrados (parpadeo).
**No sonríe nunca.**

---

## 2D (dibujo, a partir de la hoja de personaje)

| Carpeta / archivo | Qué es | Para qué |
|---|---|---|
| `2d/hoja-personaje-2d.png` | Hoja del personaje: poses, caras y colores (con sus códigos). | Referencia rápida. |
| `2d/svg/` | **Vector** (SVG). Cada pose en 5 colores y con las 3 caras. | Escalar sin perder calidad en Illustrator, Figma, Canva o After Effects. |
| `2d/png/` | Lo mismo en **PNG transparente** de 1200 px de alto. | Arrastrar directamente a CapCut, Premiere, etc. |
| `2d/clips-verde/` | Un clip por movimiento sobre **verde croma** (#00FF00). | Poner al plátano encima de cualquier video con "clave cromática". |
| `2d/videos/` | Prueba de movimientos y la secuencia de 5 plátanos con pantallas negras. | Ver cómo se mueve. |

Los archivos se llaman `<pose>_<color>_<cara>`. Por ejemplo, `sentado_verde_u-invertida.svg`.

- **Poses:** frente, frente-2, tres-cuartos, perfil, espalda, caminar-1/2/3, cabizbajo, sentado, llamando, abrazando-rodillas.
- **Colores:** amarillo `#FED710`, verde `#B4D95F`, rosa `#FFA4C7`, azul `#8CD2FF` y morado `#C4A5FF`.
  - Contorno `#0B0402`.
  - Tallo `#B76738` (arriba), `#80401C` (delante) y `#4C270D` (lado).
- **Caras:** `normal`, `u-invertida`, `ojos-cerrados`. Perfil y espalda no tienen cara.
- `movil.svg` / `movil.png`: el móvil en su soporte.

Para que el personaje mire al otro lado, voltéalo en horizontal en el editor.

### Clips en verde

| Clip | Duración |
|---|---|
| 01 Giro (frente, 3/4, perfil, espalda) | 4,0 s |
| 02 Mirada, parpadeo y boca en U invertida | 2,6 s |
| 03 Caminar | 3,5 s |
| 04 Sentarse | 1,4 s |
| 05 Mirar el móvil y llamar con la mano | 3,6 s |
| 06 Abrazar las rodillas | 2,2 s |
| 07 Levantarse y quedarse cabizbajo | 3,2 s |

---

## 3D (juguete de vinilo, a partir de la hoja 3D)

| Archivo | Qué es |
|---|---|
| `3d/hoja-personaje-3d.png` | Vistas, poses, caras y colores del modelo 3D. |
| `3d/videos/` | Prueba de movimientos y la secuencia de 5 plátanos en 3D. |

El modelo 3D tiene las mismas medidas, poses y caras que el 2D, y usa el mismo guion de animación.

---

## Generar contenido nuevo (código)

Necesitas Node 18+, Playwright (con Chromium), ffmpeg y Python 3 con `opencv-python-headless`, `numpy` y `scikit-image`.

```bash
# 2D
python3 scripts/sprites_from_sheet.py        # redibuja en vector las poses de la hoja (assets/sheet/poses-2d.png)
python3 scripts/export_kit_2d.py             # -> personaje/2d/svg
node scripts/export-kit-png.cjs 1200         # -> personaje/2d/png (alto en px)
node scripts/render-toon.cjs test            # prueba de movimientos 2D -> out/sprite2d-test.mp4
node scripts/render-toon.cjs show            # secuencia de 5 plátanos 2D -> out/sprite2d-show.mp4
node scripts/render-toon.cjs test --bg green --clips personaje/2d/clips-verde   # clips en verde

# 3D
node scripts/render-toon.cjs test --page toy3d   # -> out/toy3d-test.mp4
node scripts/render-toon.cjs show --page toy3d   # -> out/toy3d-show.mp4
```

### Qué hace cada archivo

| Parte | Archivos |
|---|---|
| Dibujo 2D | `src/sprite-banana.js` (pinta una pose, con la cara animable) y `src/sprites-data.js` (las formas en vector). |
| Animación 2D | `src/sprite-anim.js` (guion: caminar, sentarse, llamar, U invertida...) y `src/sprite2d.html`. |
| Modelo 3D | `src/toy3d.js` (medidas, poses y caras). |
| Animación 3D | `src/anim3d.js` y `src/toy3d.html`. El guion está en `src/toon-anim.js`. |
| Hojas de referencia originales | `assets/sheet/`. |

En el editor de vídeo, mete los virales donde están las pantallas negras ("VIDEO 1", "VIDEO 2"...).
Al acabar cada uno, los plátanos ponen la boca en U invertida.
