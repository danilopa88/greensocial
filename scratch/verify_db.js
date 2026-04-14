const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Verificando colunas...');

const tables = ['posts', 'comments', 'post_likes'];

tables.forEach(table => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
        if (err) {
            console.error(`Erro ao verificar tabela ${table}:`, err.message);
            return;
        }
        const cols = rows.map(r => r.name);
        console.log(`Tabela ${table}:`, cols);
        if (cols.includes('created_at') && cols.includes('updated_at')) {
            console.log(`✅ ${table} tem as colunas corretas.`);
        } else {
            console.log(`❌ ${table} está faltando colunas.`);
        }
    });
});
