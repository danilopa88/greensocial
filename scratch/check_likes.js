const db = require('../src/database');

setTimeout(() => {
    db.all("PRAGMA table_info(post_likes)", (err, rows) => {
        if (err) { console.error(err.message); process.exit(1); }
        console.log('Estrutura de post_likes:');
        rows.forEach(r => console.log(`  cid=${r.cid} name=${r.name} type=${r.type} pk=${r.pk}`));
        
        db.all("SELECT * FROM post_likes LIMIT 5", (err, rows2) => {
            console.log('\nDados em post_likes:');
            console.log(rows2);
            process.exit(0);
        });
    });
}, 800);
