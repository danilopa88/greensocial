const db = require('../src/database');

setTimeout(() => {
    db.all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ('deletion_audit','posts','comments')", (err, rows) => {
        if (err) { console.error(err.message); process.exit(1); }
        rows.forEach(r => {
            if (r.name === 'deletion_audit') {
                console.log(`deletion_audit: exists ✅`);
            } else {
                const hasSetNull = r.sql.includes('SET NULL');
                console.log(`${r.name}: ${hasSetNull ? 'SET NULL ✅' : 'CASCADE ❌'}`);
            }
        });
        process.exit(0);
    });
}, 800);
