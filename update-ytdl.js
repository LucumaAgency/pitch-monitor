// Script para actualizar ytdl-core
const { exec } = require('child_process');

console.log('📦 Actualizando ytdl-core...');

exec('npm update ytdl-core', (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.log('✅ ytdl-core actualizado');
    
    // Verificar versión
    const ytdl = require('ytdl-core');
    const version = require('ytdl-core/package.json').version;
    console.log(`📌 Versión de ytdl-core: ${version}`);
});