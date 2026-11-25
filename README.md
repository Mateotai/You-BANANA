# You-BANANA 🍌

Un plátano amarillo, sentado y abrazándose las rodillas, que **reacciona a videos virales**.
Está calcado de la figura impresa en PLA de las fotos (7,2 cm de alto, 4,2 cm de ancho, 3 cm de fondo):
cuerpo con aristas, tallo marrón cuadrado, dos puntitos de ojos y una rayita de boca.

Hay dos estilos para comparar:

| | Archivo | Cómo es |
|---|---|---|
| **2D** | `videos/banana-2d.mp4` | Dibujo cartoon con contorno marrón oscuro, sombreado plano. Se lee muy bien en pantalla pequeña. |
| **3D** | `videos/banana-3d.mp4` | Figura en 3D con las medidas reales, luz cálida de foto de producto y las líneas de impresión de la PLA. Se parece más al juguete. |

Los dos usan **el mismo guion**, así se comparan tal cual.

## Formato del video

- Vertical **1080×1920, 30 fps, 16 s** (TikTok / Reels / Shorts).
- **Arriba** está la pantalla negra que pone **VIDEO**. Ahí va el video viral, con su barra de progreso.
- **Abajo** está el plátano en una peana blanca, debajo de la pantalla, mirándola. Es la fórmula clásica de los videos de reacción: el que ve el video y la reacción, juntos en el mismo plano vertical.

## Por qué es gracioso (análisis del guion)

El chiste de este personaje es su **cara de póker**: dos puntos y una raya. Así que la regla es
**reaccionar lo mínimo, pero en el momento exacto**. Cuanto menos se mueve, más gracia tiene cuando por fin se mueve.

| Tiempo | Qué pasa | Por qué funciona |
|---|---|---|
| 0,0 s | Está sentado. Parpadea. No pasa nada más. | El gancho es lo absurdo: un plátano serio, en una peana, mirándote. |
| 1,0 s | Mira hacia arriba, al video, y sigue la acción con los ojos. | Deja claro el formato en 1 segundo: "este plátano está viendo algo". |
| 4,0 s | **Gira de golpe hacia la cámara**, se te queda mirando y aparece "**...**". Hace un parpadeo lento. | Es la mirada a cámara de *The Office*: rompe la cuarta pared y te hace cómplice ("¿tú también estás viendo esto?"). El silencio es parte del chiste. |
| 5,8 s | Vuelve a mirar el video. | Calma antes del susto. |
| 6,6 s | **Algo pasa en el video** (destello y temblor de pantalla, sonido de disco rayado). | Aquí es donde, en tu edición, va **el momento más fuerte del video viral**. |
| 6,8–7,6 s | **Zoom dramático en 3 golpes** a la cara, con "BOOM" grave, ojos enormes y boca en "o". | Es el meme del zoom dramático: el plátano soso de repente se vuelve una telenovela. |
| 8,2–9,6 s | En primerísimo plano **se pone verde** y le cae una gota de sudor. | Un chiste propio del personaje: del asco "se le quita lo maduro" y vuelve a verde. Además usa la versión verde de la figura, que también existe. |
| 9,6 s | Corte al plano general: está verde, con la boca ondulada, **balanceándose abrazado a las rodillas** y con trombón triste. | La postura de abrazarse las rodillas ya parece de "estoy traumatizado". Solo hay que balancearlo. |
| 12,8 s | Se recupera, vuelve a amarillo... y vuelve a mirar el video. | — |
| 13,2 s | **↻ Le da al replay.** Lo vuelve a ver. | El remate: dice que le ha traumatizado, pero lo vuelve a poner. Es lo que hace todo el mundo con los virales. |
| 14,2 s | Mira a cámara, doble parpadeo, y sigue viendo. | El final enlaza con el principio, así el video **se repite en bucle** sin que se note (más retención). |

### Consejos para editar con videos reales

1. **Sincroniza el "6,6 s" con el clímax del viral.** Es lo único que tienes que mover: recorta el viral para que su momento fuerte caiga ahí.
2. Si el viral es **cringe o asqueroso**, usa el guion tal cual (lo de ponerse verde). Si es **impresionante**, puedes cortar en el zoom (7,6 s) y pasar directamente a la mirada final a cámara.
3. **Deja el audio del viral bajo** (≈ -12 dB) en el "..." para que se note el silencio, y **súbelo** justo antes del zoom.
4. Pon el texto (por ejemplo "POV: el plátano ve…") **dentro de la zona del video**, arriba, para no tapar al plátano.
5. **2D vs 3D:** el 3D se parece más a la figura y destaca en el feed. El 2D es más rápido de producir en serie y se entiende mejor en miniatura. Una buena estrategia: el 3D como "personaje principal" del canal y el 2D para stickers o miniaturas.

## Pantalla verde (para meter el video de verdad)

```bash
npm run render:green      # pantalla en verde chroma #00ff00 -> out/banana-3d-greenscreen.mp4
node scripts/render.cjs --mode 2d --screen green
```

En CapCut o Premiere aplica "Clave cromática" al verde y pon el video viral debajo.

## Cómo generarlo

Necesitas Node 18+, Playwright (con Chromium) y ffmpeg.

```bash
npm install
npm run render:2d     # -> out/banana-2d.mp4
npm run render:3d     # -> out/banana-3d.mp4
node scripts/render.cjs --mode 3d --still 2,7.8   # fotogramas sueltos en PNG
```

Vista previa en vivo: sirve la carpeta (por ejemplo con `npx serve .`) y abre
`src/stage.html?mode=3d&play=1` o `src/stage.html?mode=2d&play=1`.

## Estructura

- `src/timeline.js`: **el guion**. Es el único sitio donde se tocan los tiempos, las miradas, el zoom, el color y los efectos de sonido.
- `src/banana2d.js`: el plátano en 2D (Canvas).
- `src/banana3d.js`: el plátano en 3D (three.js), con las medidas reales en cm.
- `src/stage.html`: la composición vertical (pantalla de video, bocadillo y viñeta).
- `scripts/render.cjs`: renderiza frame a frame con Chromium y monta el MP4 con ffmpeg.
- `scripts/sfx.mjs`: sintetiza los efectos de sonido (parpadeo, pop, disco rayado, boom, whoosh, trombón triste, rebobinado). No usa audios con copyright.
