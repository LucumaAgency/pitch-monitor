# 📁 ESTRUCTURA DEL PROYECTO

```
pitch-monitor/
│
├── 🔥 server.cjs              # Backend (Express + ytdl-core)
├── 📦 package.json            # Dependencias y scripts
├── 🔐 .env                    # Variables de entorno (crear local)
├── 📝 logger.js               # Sistema de logging
│
├── 📱 frontend/
│   ├── src/                  # Código fuente
│   │   ├── index.html        # UI principal
│   │   ├── app-final.js      # Lógica detección pitch
│   │   └── app-*.js          # Versiones alternativas
│   └── dist/                 # Build producción
│
├── 📊 logs/
│   ├── debug.log             # Logs generales
│   └── error.log             # Solo errores
│
└── 🚀 Deployment
    ├── ecosystem.config.js   # PM2 config
    └── PLESK_SETUP.md        # Guía deployment

```

## 🎯 ARQUITECTURA

### Backend (Node.js/Express)
- **server.cjs** - Servidor principal
- **APIs:**
  - `/api/youtube-stream/:id` - Stream audio YouTube
  - `/api/youtube-audio/:id` - Info del video
  - `/api/health` - Estado del servidor
  - `/api/logs` - Ver logs

### Frontend (Vanilla JS)
- **index.html** - Interfaz usuario
- **app-final.js** - Web Audio API + Detección pitch
- **Algoritmos:** YIN + Autocorrelación

## 📝 SCRIPTS NPM

```bash
npm start          # Producción
npm run dev        # Desarrollo con hot-reload
npm run build      # Construir para producción
npm run logs       # Ver logs en tiempo real
npm test           # Test básico del servidor
```

## 🔧 CONFIGURACIÓN

### Variables de Entorno (.env)
```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://tudominio.com
```

### Desarrollo Local
```bash
npm install
npm run dev
# Abrir http://localhost:3000
```

### Producción (Plesk)
```bash
npm install --production
npm run build
npm start
```

## 🌐 ENDPOINTS

### Frontend
- `/` - Aplicación principal

### Backend APIs
- `/api/youtube-stream/:videoId` - Audio streaming
- `/api/youtube-audio/:videoId` - Metadata del video
- `/api/health` - Health check
- `/api/logs` - Últimos 100 logs
- `/api/logs?lines=500` - Más líneas
- `/api/logs?type=error` - Solo errores
- `/api/logs/clear` - Limpiar logs

## 🔍 DEBUGGING

### Ver Logs
```bash
# Terminal
npm run logs

# Browser
https://tudominio.com/api/logs
```

### Health Check
```bash
curl https://tudominio.com/api/health
```

## 📦 DEPENDENCIAS

### Producción
- express - Servidor web
- cors - Manejo CORS
- ytdl-core - Extractor YouTube

### Desarrollo
- nodemon - Hot reload

## 🚀 DEPLOYMENT PLESK

1. Git pull
2. `Application Startup File: server.cjs`
3. `Application Root: /`
4. NPM Install
5. Restart App

Ver `PLESK_SETUP.md` para detalles completos.