# Reacciones a videos reales

Cada reacción es un archivo `.json` en esta carpeta. El video viral va en `reactions/videos/`.
Esa carpeta no se sube a git, porque los virales son de sus autores.

```bash
node scripts/render.cjs --mode 3d --plan reactions/novio.json   # -> out/banana-3d-novio.mp4
node scripts/render.cjs --mode 2d --plan reactions/novio.json   # -> out/banana-2d-novio.mp4
```

## Campos

| Campo | Qué es |
|---|---|
| `video` | Ruta del viral, relativa a este archivo (por ejemplo `videos/novio.mp4`). |
| `trimStart`, `trimEnd` | Trozo del viral que se usa, en segundos. Sirve para quitar el cierre de TikTok con el logo. |
| `fit` | `cover` llena la pantalla recortando (lo mejor para virales verticales). `contain` lo muestra entero con fondo desenfocado. |
| `focusY` | Con `cover`, qué altura del viral queda en el centro (0 = arriba, 1 = abajo). Ajústalo para que se vean la cara y el texto. |
| `volume`, `duck`, `sfxVolume` | Volumen del viral (1.6 por defecto), cuánto baja durante el "..." (0.3) y volumen de los efectos (0.8). |
| `timeline.lookUp` | Segundo en que el plátano empieza a mirar la pantalla. |
| `timeline.videoStart` | Segundo del video final en que empieza el viral (normalmente 0). |
| `timeline.glance` | Segundo en que mira a cámara con "...". Ponlo cuando ya se ha entendido de qué va el viral. |
| `timeline.glance2` | (Opcional) Una mirada rapidísima a cámara, tipo "doble toma". |
| `timeline.shock` | **El momento fuerte del viral.** Ahí empiezan el destello, el disco rayado y los 3 BOOM del zoom. |
| `timeline.rockDur` | Cuánto dura el balanceo "traumatizado" (en segundos). |

El resto del guion se calcula solo a partir de estos tiempos: parpadeos, sudor, replay final y duración total.
Al final, el plátano le da al replay y el viral vuelve a empezar, así que el video queda en bucle.

## Programa en cadena (`render-show.cjs`)

`episodio1.json` es una lista de videos que se reproducen uno detrás de otro:

```json
{
  "name": "episodio1",
  "react": 1.5,
  "videos": [
    { "video": "videos/novio.mp4", "trimStart": 0, "trimEnd": 12.25, "focusY": 0.55 },
    { "placeholder": "VIDEO 2", "duration": 4 }
  ]
}
```

- `react`: segundos de reacción (U invertida) entre un video y el siguiente.
- `focusY`: qué altura del viral queda en el centro al llenar la pantalla.
- `volume`: volumen de cada viral (1.6 por defecto).
