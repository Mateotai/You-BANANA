# Imágenes del canal de YouTube

| Archivo | Para qué | Medidas de YouTube |
|---|---|---|
| `foto-perfil-800x800.png` | Foto de perfil del canal. | 800×800. YouTube la recorta en círculo. |
| `banner-2560x1440.png` | Banner del canal. | 2560×1440. En móvil solo se ve el centro (1546×423) y ahí está todo lo importante. |
| `marca-de-agua-150x150.png` | Marca de agua que YouTube pone en tus vídeos. | 150×150 PNG transparente. |
| `banner-zonas-guia.png` | El banner con las zonas que se ven en TV, ordenador y móvil. | Solo de guía: no la subas. |
| `vista-previa-canal.png` | Simulación aproximada de cómo queda la cabecera del canal en ordenador. | Solo de guía. |

**Dónde se suben:** YouTube Studio → Personalización → Imagen de marca. Ahí están la foto, el banner y la marca de agua del vídeo.

**Para cambiar el nombre o los textos:**

```bash
node scripts/export-brand.cjs "Nombre del canal" "We've seen things." ["segunda línea opcional"]
```

El diseño está en `src/brand.html` y usa los dibujos en vector del personaje.
