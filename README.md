# Pitch Monitor - Detector de Notas Musical

## Arquitectura Implementada

### Stack Tecnológico
- **Frontend**: HTML5, JavaScript vanilla con Web Audio API
- **Backend**: Node.js + Express para proxy de YouTube
- **Algoritmos**: Autocorrelación y YIN para detección de pitch
- **Visualización**: Canvas API para formas de onda y espectro

### Componentes Clave

1. **Motor de Detección de Pitch**
   - Implementación de autocorrelación básica (`app.js`)
   - Implementación mejorada con algoritmo YIN (`app-enhanced.js`)
   - FFT de 4096 muestras para mayor precisión

2. **Captura de Audio**
   - getUserMedia API para micrófono
   - MediaElementSource para YouTube
   - Analysers separados para cada fuente

3. **Servidor Proxy**
   - Evita problemas de CORS con YouTube
   - Streaming de audio en tiempo real
   - ytdl-core para extracción de audio

## Instalación y Uso

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Modo desarrollo
npm run dev
```

Abrir navegador en `http://localhost:3000`

## Decisiones de Arquitectura

### 1. **JavaScript Vanilla vs Framework**
Elegí vanilla JS para:
- Menor latencia en procesamiento de audio
- Control directo sobre Web Audio API
- Sin overhead de virtual DOM

### 2. **Algoritmo YIN vs Autocorrelación**
Incluí ambos porque:
- Autocorrelación: Más rápido, suficiente para voces claras
- YIN: Mayor precisión, mejor para instrumentos complejos

### 3. **Servidor Proxy Necesario**
YouTube no permite acceso directo al audio por CORS. El servidor:
- Extrae el stream de audio
- Lo convierte a formato compatible
- Mantiene baja latencia

## Mejoras Futuras Recomendadas

1. **Machine Learning**
   - TensorFlow.js con modelo Crepe para mejor precisión
   - Entrenamiento con datos específicos del usuario

2. **WebRTC**
   - Para sincronización en tiempo real con múltiples usuarios
   - Sesiones de práctica colaborativas

3. **Progressive Web App**
   - Service Workers para offline
   - Caché de análisis previos

4. **Análisis Avanzado**
   - Detección de vibrato
   - Análisis de timbre
   - Métricas de estabilidad de pitch

## Consideraciones de Rendimiento

- **Buffer Size**: 4096 samples = ~93ms latencia @ 44.1kHz
- **Smoothing**: 0.8 para balance entre respuesta y estabilidad
- **RAF**: 60fps para visualización fluida
- **Threshold YIN**: 0.1 para balance precisión/velocidad

## Limitaciones Conocidas

1. YouTube API requiere servidor proxy
2. Latencia inherente de ~100ms en detección
3. Precisión disminuye en frecuencias < 80Hz
4. Requiere HTTPS para getUserMedia en producción