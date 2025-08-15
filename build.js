// Script de build para preparar archivos para producción
const fs = require('fs');
const path = require('path');

console.log('🔨 Building Pitch Monitor...');

// Crear carpeta public si no existe
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('📁 Created public directory');
}

// Copiar archivos del frontend
const frontendSrc = path.join(__dirname, 'frontend', 'src');
const files = ['index.html', 'app-final.js', 'app-enhanced.js', 'app-hybrid.js', 'app-screencapture.js'];

files.forEach(file => {
    const srcPath = path.join(frontendSrc, file);
    const destPath = path.join(publicDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`✅ Copied ${file}`);
    } else {
        console.log(`⚠️  ${file} not found`);
    }
});

console.log('📦 Build complete! Files in public/ directory');
console.log('🚀 Ready for deployment');