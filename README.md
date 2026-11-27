# You-BANANA 🍌

Un plátano amarillo, sentado y abrazándose las rodillas, que **reacciona a videos virales**.
Es una copia lo más fiel posible de la figura impresa en PLA de las fotos (7,2 cm de alto):
misma postura, misma cara (dos puntitos y una rayita), tallo marrón cuadrado y **todo de una sola pieza**.
Brazos y piernas salen del cuerpo sin cortes y sin bolas en las articulaciones. Siempre es amarillo.

Hay dos estilos para comparar:

| | Archivo | Cómo es |
|---|---|---|
| **2D** | `videos/banana-2d.mp4` | Ilustración plana **calcada de la foto** (vista 15/17): la silueta, las sombras y los pliegues salen de la propia foto, con un único contorno exterior. |
| **3D** | `videos/banana-3d.mp4` | Réplica 3D de la figura: un único sólido (cuerpo, brazos y piernas fundidos), tallo encajado en un corte inclinado, luz de foto de producto y líneas de impresión de la PLA. |

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
| 6,8–7,6 s | **Zoom dramático en 3 golpes** a la cara, con "BOOM" grave. **La cara no cambia nada.** | El meme del zoom dramático funciona mejor con una cara de póker: todo es épico menos él. |
| 8,7 s | Silencio total en primerísimo plano... y **un parpadeo lento**. Luego le cae una gota de sudor. | Después de tres BOOM, la única reacción es parpadear. Ese contraste es el chiste. |
| 9,6 s | Corte al plano general: **se balancea abrazado a las rodillas**, con trombón triste. | La postura de abrazarse las rodillas ya parece de "estoy traumatizado". Solo hay que balancearlo. |
| 12,8 s | Para de balancearse... y vuelve a mirar el video. | — |
| 13,2 s | **↻ Le da al replay.** Lo vuelve a ver. | El remate: dice que le ha traumatizado, pero lo vuelve a poner. Es lo que hace todo el mundo con los virales. |
| 14,2 s | Mira a cámara, doble parpadeo, y sigue viendo. | El final enlaza con el principio, así el video **se repite en bucle** sin que se note (más retención). |

### Consejos para editar con videos reales

1. **Sincroniza el "6,6 s" con el clímax del viral.** Es lo único que tienes que mover: recorta el viral para que su momento fuerte caiga ahí.
2. Si el viral es **cringe o asqueroso**, usa el guion tal cual (sudor y balanceo). Si es **impresionante**, puedes cortar en el zoom (7,6 s) y pasar directamente a la mirada final a cámara.
3. **Deja el audio del viral bajo** (≈ -12 dB) en el "..." para que se note el silencio, y **súbelo** justo antes del zoom.
4. Pon el texto (por ejemplo "POV: el plátano ve…") **dentro de la zona del video**, arriba, para no tapar al plátano.
5. **2D vs 3D:** el 3D se parece más a la figura y destaca en el feed. El 2D es más rápido de producir en serie y se entiende mejor en miniatura. Una buena estrategia: el 3D como "personaje principal" del canal y el 2D para stickers o miniaturas.

## Plátano 2D de la hoja de personaje (versión actual)

`src/toon.js` dibuja el plátano con las medidas tomadas de la hoja de personaje. Es una sola silueta con contorno negro, y brazos y piernas se funden con el cuerpo. Gira de forma continua (frente, 3/4, perfil y espalda), anda, se sienta, llama con la mano, se abraza las rodillas, pone la boca en U invertida y parpadea.

```bash
node scripts/render-toon.cjs test   # -> out/toon-test.mp4: prueba de movimientos (para validar el personaje)
node scripts/render-toon.cjs show   # -> out/toon-show.mp4: secuencia de 5 plátanos con pantallas negras como videos
```

El guion de las dos animaciones está en `src/toon-anim.js`.

## Programa de reacciones en cadena (plátano 2D que anda, se sienta y se levanta)

El plátano 2D tiene brazos y piernas articulados (`src/banana-rig.js`), con el mismo cuerpo, tallo y cara del calco.
Al acabar cada video pone la boca en **U invertida (∩)** y pasa al siguiente. Hay dos formatos:

| Formato | Cómo es |
|---|---|
| `sofa` | El viral ocupa **toda la mitad de arriba**. Abajo, el plátano llega andando, se sube al sofá y lo mira. Al acabar cada video mira a cámara con la U invertida y entra el siguiente. |
| `pie` | El plátano, de pie, ocupa toda la pantalla mirando a un lado. Se gira y **el viral sale a pantalla completa**. Al acabar vuelve el plátano, pone la U invertida, se gira al otro lado y entra el siguiente. |

| `pie3d` | Como `pie`, pero **en 3D y con pandilla**. Al acabar cada video, todos ponen la U invertida a la vez. Luego el amarillo saluda con un "¡Ven!" y llega andando otro plátano de otro color (rosa, azul, verde, morado...) a ver el siguiente video. |

```bash
node scripts/render-show.cjs reactions/episodio1.json --format pie3d  # -> out/show-episodio1-pie3d.mp4
node scripts/render-show.cjs reactions/episodio1.json --format sofa   # -> out/show-episodio1-sofa.mp4
node scripts/render-show.cjs reactions/episodio1.json --format pie    # -> out/show-episodio1-pie.mp4
```

En `reactions/episodio1.json` pones la lista de videos, en orden. Los que aún no tienes pueden ser marcadores (`"placeholder": "VIDEO 2"`).

## Meter un video viral de verdad

```bash
node scripts/render.cjs --mode 3d --plan reactions/novio.json
```

El viral se ve dentro de la pantalla, sincronizado con el guion y con su audio mezclado con los efectos.
Instrucciones en [`reactions/README.md`](reactions/README.md).

## Pantalla de croma (opcional, para meter el video de verdad)

```bash
npm run render:green      # sólo la PANTALLA en croma #00ff00 (el plátano sigue amarillo)
node scripts/render.cjs --mode 2d --screen green
```

En CapCut o Premiere aplica "Clave cromática" a la pantalla y pon el video viral debajo.

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

- `src/timeline.js`: **el guion**. Es el único sitio donde se tocan los tiempos, las miradas, el zoom y los efectos de sonido.
- `src/banana2d.js` + `src/banana2d-data.js`: el plátano en 2D (Canvas), con las formas calcadas de la foto.
- `scripts/trace_reference.py`: el calco. Saca de la foto la silueta, los tonos, los pliegues, el tallo, los ojos y la boca (`python3 scripts/trace_reference.py foto.jpg`; necesita `opencv-python-headless`).
- `src/banana3d.js`: el plátano en 3D (three.js), en cm. Se modela como una SDF con uniones suaves y se convierte en malla con *marching cubes*. Así es una sola pieza.
- `src/stage.html`: la composición vertical (pantalla de video, bocadillo y viñeta).
- `scripts/render.cjs`: renderiza frame a frame con Chromium y monta el MP4 con ffmpeg.
- `scripts/sfx.mjs`: sintetiza los efectos de sonido (parpadeo, pop, disco rayado, boom, whoosh, trombón triste, rebobinado). No usa audios con copyright.
