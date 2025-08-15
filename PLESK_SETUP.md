# Configuración para Plesk con Node.js

## Requisitos Previos
- Plesk con soporte para Node.js (Plesk Obsidian 18.0.30+)
- Dominio configurado en Plesk
- Git ya integrado (como mencionaste)

## Pasos de Configuración

### 1. Configuración de Node.js en Plesk

1. **En el Panel de Plesk:**
   - Ve a tu dominio
   - Busca "Node.js" en las opciones
   - Haz clic en "Enable Node.js"

2. **Configuración de la Aplicación Node.js:**
   ```
   Node.js version: 18.x o superior
   Package manager: npm
   Document Root: /httpdocs (o donde hayas clonado el repo)
   Application Root: /httpdocs (mismo que Document Root)
   Application Startup File: server.js
   ```

3. **Variables de Entorno (Application parameters):**
   ```
   NODE_ENV: production
   PORT: 3000
   ```

### 2. Instalación de Dependencias

En la sección de Node.js de Plesk:

1. Haz clic en "NPM Install" o ejecuta en el terminal:
   ```bash
   cd /var/www/vhosts/tudominio.com/httpdocs
   npm install --production
   ```

### 3. Configuración del Proxy

**Opción A: Si Plesk usa Nginx (Recomendado)**

En Plesk > Dominios > Tu dominio > Apache & nginx Settings > Additional nginx directives:

```nginx
# Proxy para las APIs de Node.js
location /api/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeouts largos para streaming
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}

# Servir archivos estáticos
location / {
    try_files $uri $uri/ /index.html;
}
```

**Opción B: Si Plesk usa solo Apache**

El archivo `.htaccess` incluido manejará el proxy automáticamente.

### 4. Configuración de Puertos

Si Plesk bloquea el puerto 3000:

1. **Cambiar puerto en Variables de Entorno:**
   ```
   PORT: 3001
   ```
   
2. **Actualizar configuración del proxy** para usar el nuevo puerto

### 5. Iniciar la Aplicación

En la sección Node.js de Plesk:

1. Haz clic en "Restart App" o "Start App"
2. Verifica el estado en "Application Status"

### 6. Configuración de SSL (HTTPS)

Si tu dominio tiene SSL:

1. **En Plesk:** Asegúrate de que SSL esté habilitado
2. **Forzar HTTPS:** En Apache & nginx Settings, marca "Permanent SEO-safe 301 redirect from HTTP to HTTPS"

### 7. Logs y Debugging

**Ver logs en Plesk:**
- Node.js > Log Files
- O en SSH: `/var/www/vhosts/tudominio.com/logs/`

**Logs personalizados:**
```bash
tail -f /var/www/vhosts/tudominio.com/httpdocs/npm-debug.log
```

## Verificación

1. **Verificar que Node.js está corriendo:**
   ```
   https://tudominio.com/api/youtube-audio/dQw4w9WgXcQ
   ```
   Deberías ver un JSON con información del video

2. **Verificar la aplicación:**
   ```
   https://tudominio.com
   ```
   Debería cargar la interfaz

## Solución de Problemas

### Error: "Cannot find module"
```bash
cd /var/www/vhosts/tudominio.com/httpdocs
npm install
```

### Error: "CORS blocked"
Verificar que el proxy esté configurado correctamente y que `trust proxy` esté habilitado en server.js

### Error: "502 Bad Gateway"
- Verificar que Node.js esté corriendo
- Revisar logs de Node.js
- Verificar puerto en configuración

### Error con ytdl-core
Si ytdl-core falla en producción, actualízalo:
```bash
npm update ytdl-core
```

## Configuración Alternativa con PM2

Si Plesk no maneja bien Node.js, puedes usar PM2:

1. **Instalar PM2 globalmente:**
   ```bash
   npm install -g pm2
   ```

2. **Iniciar con PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## Notas Importantes

- **Seguridad:** Configura un firewall para bloquear acceso directo al puerto 3000
- **Performance:** Considera usar Redis para caché si tienes muchos usuarios
- **Límites:** YouTube API tiene límites de rate, considera implementar caché
- **HTTPS:** Es obligatorio para getUserMedia (micrófono) en producción