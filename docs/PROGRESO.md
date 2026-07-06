# Pitch Monitor — Notas de desarrollo

Documento de contexto para retomar el proyecto en el futuro. Última actualización: 2026-07-06.

## Qué es
Web app para **detectar notas musicales**: capta tu voz por micrófono, detecta el pitch
en tiempo real y lo compara con la nota de una canción. Incluye además un modo juego
"Pitch Test" (tipo Guitar Hero) que ya existía.

- Repo: `github.com/LucumaAgency/pitch-monitor` (rama `main`)
- Deploy: **Plesk** con Node.js.
- Stack: frontend HTML + JS vanilla (Web Audio API, Canvas); backend Node + Express.

## Arquitectura (importante)
- **Servidor canónico: `server.cjs`** (es el `main` de package.json; el más robusto:
  logging, manejo de errores, handlers de uncaughtException). `npm start` y el
  *Application Startup File* de Plesk deben apuntar a **`server.cjs`**.
- Sirve archivos estáticos desde **`frontend/`**.
- **Pipeline de build:** la fuente real es **`frontend/src/`**. `build.js` copia
  `frontend/src/*` → `public/`, y `setup-frontend.js` copia `public/*` → `frontend/`.
  El `postinstall` corre ambos. **Siempre editar en `frontend/src/` y luego correr
  `npm run build`** (o `node build.js && node setup-frontend.js`). Si no, producción
  sirve una versión vieja (ese fue un bug real).
- Archivos clave del frontend: `frontend/src/index.html` (UI + estilos inline) y
  `frontend/src/app-final.js` (toda la lógica de audio/pitch/gráfico).
- Hay ~9 servidores de respaldo muertos (`server-minimal.js`, `server-simple.js`,
  `emergency-server.js`, etc.) — pendientes de limpiar, no se usan.

## Limitación de YouTube (no arreglable por código)
El backend tenía un proxy `ytdl-core` para extraer el audio de YouTube y analizarlo.
**YouTube bloquea la extracción** (ytdl devuelve 403 / "Could not extract functions");
ni el fork mantenido `@distube/ytdl-core` puede descifrar el stream actual. El audio del
iframe de YouTube tampoco se puede analizar (cross-origin). Por eso la comparación con
YouTube se abandonó. Migramos la dependencia a `@distube/ytdl-core` para que al menos
degrade con error limpio y no tumbe el proceso, pero **la fuente de "la canción" es un
archivo MP3 local**, no YouTube.

## Cómo funciona hoy
- **Tu nota (micrófono):** botón "Iniciar Micrófono" → getUserMedia → analiza pitch.
- **Nota de la canción:** input de archivo `#audioFile` → sube un MP3/WAV → se reproduce
  con `<audio controls>` y se analiza con Web Audio API (`setupAudioAnalysisFromFile`).
  Al cargar un MP3, el player de YouTube se oculta y se detiene.
- **YouTube** quedó plegado en un `<details>` como "solo verlo".

### Detección de pitch (`improvedAutocorrelate`)
Algoritmo probado tipo cwilso/PitchDetect: recorta silencio en bordes, calcula
autocorrelación hasta `maxLag`, **salta el pico de lag 0** (evita errores de octava),
busca el máximo dentro de la banda **70–1200 Hz** y refina con interpolación parabólica.
Verificado numéricamente: <0.1% de error en tonos puros y con armónicos, sin saltos de
octava, ~3.3 ms/frame. Umbral de ruido (RMS): **0.005 para el micrófono** (señal más
débil, sobre todo con autoGainControl off) y 0.01 para la canción.
En `startMicrophone` se hace `audioContext.resume()` (en móvil/iOS el contexto arranca
suspendido y si no, el micrófono no entrega audio → "Tu Nota" quedaba en `--`).

### Gráfico de pitch en el tiempo (referencia: `siren.jpg`)
Canvas `#waveformCanvas` (720px de alto, fondo oscuro):
- Eje Y = notas en escala logarítmica, **rango FIJO C2–C6** (no se auto-escala; se probó
  auto-rango dinámico pero al usuario le molestaba que las líneas se movieran).
- Rejilla con **una línea y etiqueta por cada nota** (C, C#, D, …), con las C resaltadas.
- Eje X = tiempo (scrolling, buffer `historyMax = 250`).
- **Dos líneas:** 🔵 tu voz (`#33c1ff`) y 🔴 la canción (`#e0533d`); se cortan en silencios.
- Métodos: `drawPitchGraph`, `drawHistoryLine`, `freqToY`, `midiToName`, `pushHistory`.

## Deploy en Plesk
1. Git pull.
2. *Application Startup File* = `server.cjs`, *Application Root* = raíz del repo.
3. NPM Install (corre `postinstall` → build).
4. Restart App.
5. HTTPS obligatorio para el micrófono (getUserMedia).

## Historial de cambios (esta ronda de trabajo)
1. Fix deploy: sync frontend, unificar en `server.cjs`, migrar a `@distube/ytdl-core`,
   handler de error en el stream, podar dep vieja. (commit `632bef7`)
2. Añadir MP3 local como fuente de la canción. (commit `5f0ebc8`)
3. Reemplazar visualización por gráfico de pitch en el tiempo + arreglar detección
   (errores de octava). (commit `210c5fe`)
4. Fix "mi nota" (resume del AudioContext + bajar umbral) + ocultar YouTube con MP3.
   (commit `d3e67c7`)
5. (revertido) Auto-escalado del eje Y. (commit `5a4dcda`)
6. Rango fijo C2–C6 con todas las notas etiquetadas, canvas 720px. (commit `d9150c6`)

## Pendientes / ideas futuras
- Opción: escanear la canción una vez al cargarla para fijar el rango exacto de ESA
  canción (en vez del fijo C2–C6 genérico). Más trabajo y menos predecible en polifonía.
- Notas fuera de C2–C6 se "aplastan" contra el borde del gráfico.
- Limpiar los ~9 servidores de respaldo muertos.
- La detección sobre música polifónica sigue la melodía dominante, no es perfecta.
