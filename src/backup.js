const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Configuração de caminhos para compatibilidade com executável (pkg)
const externalDir = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..');
const dbPath = process.pkg 
    ? path.join(externalDir, 'database.sqlite')
    : path.resolve(__dirname, 'database.sqlite');
const backupsDir = path.join(externalDir, 'backups');

/**
 * Realiza o backup do banco de dados SQLite.
 * Copia o arquivo database.sqlite para a pasta backups/ com um carimbo de data.
 */
function performBackup() {
    console.log('🕒 Iniciando processo de backup...');

    if (!fs.existsSync(dbPath)) {
        console.error('❌ Erro: Arquivo de banco de dados não encontrado em:', dbPath);
        return;
    }

    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    const date = new Date();
    const timestamp = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const backupFileName = `backup-${timestamp}.sqlite`;
    const backupPath = path.join(backupsDir, backupFileName);

    try {
        fs.copyFileSync(dbPath, backupPath);
        console.log(`✅ Backup concluído com sucesso: ${backupFileName}`);
        cleanupOldBackups();
    } catch (err) {
        console.error('❌ Erro ao realizar backup:', err.message);
    }
}

/**
 * Remove backups antigos, mantendo apenas os últimos 7 dias.
 */
function cleanupOldBackups(daysToKeep = 7) {
    fs.readdir(backupsDir, (err, files) => {
        if (err) {
            console.error('❌ Erro ao ler pasta de backups para limpeza:', err.message);
            return;
        }

        const backupFiles = files
            .filter(f => f.startsWith('backup-') && f.endsWith('.sqlite'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(backupsDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Do mais novo para o mais antigo

        if (backupFiles.length > daysToKeep) {
            const filesToRemove = backupFiles.slice(daysToKeep);
            filesToRemove.forEach(file => {
                const filePath = path.join(backupsDir, file.name);
                fs.unlinkSync(filePath);
                console.log(`🧹 Backup antigo removido: ${file.name}`);
            });
        }
    });
}

/**
 * Inicia o agendamento de backups.
 */
function initBackupScheduler() {
    // Agendado para meia-noite todos os dias (00:00)
    cron.schedule('0 0 * * *', () => {
        performBackup();
    });

    console.log('📅 Agendador de backups diários iniciado (00:00).');

    // Verifica se já existe um backup de hoje, se não, faz um logo ao iniciar
    const timestamp = new Date().toISOString().split('T')[0];
    const todayBackupPath = path.join(backupsDir, `backup-${timestamp}.sqlite`);
    
    if (!fs.existsSync(todayBackupPath)) {
        console.log('ℹ️ Backup de hoje não encontrado. Realizando backup inicial...');
        performBackup();
    }
}

module.exports = {
    initBackupScheduler,
    performBackup
};
