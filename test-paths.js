// Script para verificar que las rutas existen
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando estructura de archivos...\n');

const files = [
    'server.cjs',
    'frontend/src/index.html',
    'frontend/src/app-final.js',
    'package.json',
    'logger.js'
];

files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    const exists = fs.existsSync(fullPath);
    console.log(`${exists ? '✅' : '❌'} ${file}`);
    if (exists) {
        const stats = fs.statSync(fullPath);
        console.log(`   Tamaño: ${stats.size} bytes`);
    }
});

console.log('\n📁 Contenido de frontend/src:');
const frontendPath = path.join(__dirname, 'frontend/src');
if (fs.existsSync(frontendPath)) {
    const files = fs.readdirSync(frontendPath);
    files.forEach(file => {
        console.log(`   - ${file}`);
    });
} else {
    console.log('   ❌ No existe la carpeta frontend/src');
}

console.log('\n🔧 Variables de entorno:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   PORT: ${process.env.PORT || 'not set'}`);
console.log(`   PWD: ${process.cwd()}`);