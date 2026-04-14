const db = require('../src/database');
setTimeout(() => {
    db.all("PRAGMA table_info(volunteers)", (err, rows) => {
        if (err) { console.error(err.message); process.exit(1); }
        const cols = rows.map(r => r.name);
        console.log('Colunas em volunteers:', cols);
        const hasPhone = cols.includes('phone');
        const hasBirth = cols.includes('birth_date');
        console.log(hasPhone ? '✅ phone existe' : '❌ phone faltando');
        console.log(hasBirth ? '✅ birth_date existe' : '❌ birth_date faltando');
        process.exit(0);
    });
}, 800);
