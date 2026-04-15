const db = require('../src/database.js');

db.serialize(() => {
    db.run('ALTER TABLE volunteers ADD COLUMN email_opt_out INTEGER DEFAULT 0', (err) => {
        if (err && err.message.includes('duplicate')) {
            console.log('email_opt_out column: already exists, skipping.');
        } else if (err) {
            console.error('Error adding email_opt_out:', err.message);
        } else {
            console.log('email_opt_out column: added successfully.');
        }
    });

    const createEmailLogs = `CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        recipients_count INTEGER NOT NULL DEFAULT 0,
        sent_by INTEGER,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sent_by) REFERENCES volunteers(id) ON DELETE SET NULL
    )`;

    db.run(createEmailLogs, (err) => {
        if (err) {
            console.error('Error creating email_logs:', err.message);
        } else {
            console.log('email_logs table: OK');
        }
        process.exit(0);
    });
});
