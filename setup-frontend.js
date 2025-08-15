// Script para preparar la carpeta frontend que espera Plesk
const fs = require('fs');
const path = require('path');

console.log('📁 Preparando carpeta frontend para Plesk...');

// Crear carpeta frontend si no existe
const frontendDir = path.join(__dirname, 'frontend');
if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
    console.log('✅ Carpeta frontend creada');
}

// Copiar archivos de public a frontend
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    files.forEach(file => {
        const src = path.join(publicDir, file);
        const dest = path.join(frontendDir, file);
        fs.copyFileSync(src, dest);
        console.log(`✅ Copiado ${file}`);
    });
} else {
    console.log('⚠️ No existe la carpeta public, copiando desde frontend/src...');
    const srcDir = path.join(__dirname, 'frontend', 'src');
    if (fs.existsSync(srcDir)) {
        const files = fs.readdirSync(srcDir);
        files.forEach(file => {
            const src = path.join(srcDir, file);
            const dest = path.join(frontendDir, file);
            fs.copyFileSync(src, dest);
            console.log(`✅ Copiado ${file} desde src`);
        });
    }
}

console.log('🚀 Listo! La carpeta frontend está preparada para Plesk');