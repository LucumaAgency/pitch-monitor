const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.logFile = path.join(this.logDir, 'debug.log');
        this.errorFile = path.join(this.logDir, 'error.log');
        
        // Crear directorio de logs si no existe
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        
        // Limpiar logs antiguos al iniciar (opcional)
        this.rotateLogsIfNeeded();
    }
    
    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
        
        // Escribir en consola
        console.log(logEntry.trim());
        
        // Escribir en archivo
        const targetFile = type === 'error' ? this.errorFile : this.logFile;
        
        fs.appendFile(targetFile, logEntry, (err) => {
            if (err) {
                console.error('Error escribiendo log:', err);
            }
        });
        
        // También escribir errores en el log general
        if (type === 'error') {
            fs.appendFile(this.logFile, logEntry, () => {});
        }
    }
    
    info(message) {
        this.log(message, 'info');
    }
    
    error(message) {
        this.log(message, 'error');
    }
    
    warning(message) {
        this.log(message, 'warning');
    }
    
    debug(message) {
        if (process.env.NODE_ENV !== 'production') {
            this.log(message, 'debug');
        }
    }
    
    rotateLogsIfNeeded() {
        // Rotar logs si son muy grandes (> 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        [this.logFile, this.errorFile].forEach(file => {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                if (stats.size > maxSize) {
                    const backupFile = file.replace('.log', `-${Date.now()}.log`);
                    fs.renameSync(file, backupFile);
                    this.log(`Log rotado: ${path.basename(file)} -> ${path.basename(backupFile)}`);
                }
            }
        });
    }
    
    getLogs(lines = 100, type = 'all') {
        try {
            const file = type === 'error' ? this.errorFile : this.logFile;
            
            if (!fs.existsSync(file)) {
                return 'No hay logs disponibles';
            }
            
            const content = fs.readFileSync(file, 'utf8');
            const logLines = content.split('\n').filter(line => line.trim());
            
            // Devolver las últimas N líneas
            return logLines.slice(-lines).join('\n');
        } catch (error) {
            return `Error leyendo logs: ${error.message}`;
        }
    }
    
    clearLogs() {
        try {
            if (fs.existsSync(this.logFile)) {
                fs.writeFileSync(this.logFile, '');
            }
            if (fs.existsSync(this.errorFile)) {
                fs.writeFileSync(this.errorFile, '');
            }
            this.log('Logs limpiados');
            return true;
        } catch (error) {
            this.error(`Error limpiando logs: ${error.message}`);
            return false;
        }
    }
}

module.exports = new Logger();