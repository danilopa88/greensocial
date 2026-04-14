const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.pkg 
    ? path.join(path.dirname(process.execPath), 'database.sqlite')
    : path.resolve(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        db.run('PRAGMA foreign_keys = ON');

        db.serialize(() => {
            // Volunteers
            db.run(`CREATE TABLE IF NOT EXISTS volunteers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                skills TEXT,
                status TEXT,
                avatar_url TEXT
            )`, () => {
                // Migração garantida para bancos existentes
                db.all("PRAGMA table_info(volunteers)", (err, columns) => {
                    if (!err && columns && !columns.some(c => c.name === 'avatar_url')) {
                        db.run('ALTER TABLE volunteers ADD COLUMN avatar_url TEXT');
                    }
                });
            });
            
            // Posts (Agora ligada ao ID do autor)
            db.run(`CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id INTEGER,
                time TEXT,
                content TEXT,
                likes INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES volunteers(id) ON DELETE SET NULL
            )`, () => {
                db.all("PRAGMA table_info(posts)", (err, columns) => {
                    if (!err && columns) {
                        if (!columns.some(c => c.name === 'created_at')) db.run("ALTER TABLE posts ADD COLUMN created_at DATETIME DEFAULT '2026-04-14 14:00:00'");
                        if (!columns.some(c => c.name === 'updated_at')) db.run("ALTER TABLE posts ADD COLUMN updated_at DATETIME DEFAULT '2026-04-14 14:00:00'");
                    }
                });
            });

            // Post Media
            db.run(`CREATE TABLE IF NOT EXISTS post_media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                type TEXT NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            )`);

            // Comments (Agora com author_id como chave estrangeira)
            db.run(`CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                author_id INTEGER,
                text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES volunteers(id) ON DELETE SET NULL
            )`, () => {
                db.all("PRAGMA table_info(comments)", (err, columns) => {
                    if (!err && columns) {
                        if (!columns.some(c => c.name === 'created_at')) db.run("ALTER TABLE comments ADD COLUMN created_at DATETIME DEFAULT '2026-04-14 14:00:00'");
                        if (!columns.some(c => c.name === 'updated_at')) db.run("ALTER TABLE comments ADD COLUMN updated_at DATETIME DEFAULT '2026-04-14 14:00:00'");
                    }
                });
            });

            // Likes Tracking (Para curtida única por usuário)
            db.run(`CREATE TABLE IF NOT EXISTS post_likes (
                post_id INTEGER NOT NULL,
                volunteer_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (post_id, volunteer_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
            )`, () => {
                db.all("PRAGMA table_info(post_likes)", (err, columns) => {
                    if (!err && columns) {
                        if (!columns.some(c => c.name === 'created_at')) db.run("ALTER TABLE post_likes ADD COLUMN created_at DATETIME DEFAULT '2026-04-14 14:00:00'");
                        if (!columns.some(c => c.name === 'updated_at')) db.run("ALTER TABLE post_likes ADD COLUMN updated_at DATETIME DEFAULT '2026-04-14 14:00:00'");
                    }
                });
            });

            // Auditoria de Acessos
            db.run(`CREATE TABLE IF NOT EXISTS user_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                volunteer_id INTEGER NOT NULL,
                login_time TEXT NOT NULL,
                logoff_time TEXT,
                FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
            )`);

            // Auditoria de Exclusões (Log de segurança)
            db.run(`CREATE TABLE IF NOT EXISTS deletion_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id INTEGER NOT NULL,
                deletion_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // === MIGRAÇÃO: Mudar CASCADE para SET NULL em Posts e Comments ===
            const migrateTable = (tableName, createSql) => {
                db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
                    // Só migra se ainda tiver CASCADE na relação com volunteers E NÃO tiver SET NULL
                    const needsMigration = !err && row && 
                        row.sql.includes('author_id') &&
                        row.sql.toUpperCase().includes('ON DELETE CASCADE') &&
                        !row.sql.toUpperCase().includes('ON DELETE SET NULL');

                    if (needsMigration) {
                        console.log(`Migrando tabela ${tableName} para suportar preservação de dados...`);
                        db.serialize(() => {
                            db.run(`PRAGMA foreign_keys = OFF`);
                            db.run(`ALTER TABLE ${tableName} RENAME TO ${tableName}_old`);
                            db.run(createSql);
                            db.run(`INSERT INTO ${tableName} SELECT * FROM ${tableName}_old`);
                            db.run(`DROP TABLE ${tableName}_old`);
                            db.run(`PRAGMA foreign_keys = ON`);
                        });
                    }
                });
            };

            const postsSql = `CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id INTEGER,
                time TEXT,
                content TEXT,
                likes INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES volunteers(id) ON DELETE SET NULL
            )`;

            const commentsSql = `CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                author_id INTEGER,
                text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES volunteers(id) ON DELETE SET NULL
            )`;

            migrateTable('posts', postsSql);
            migrateTable('comments', commentsSql);

            // Seed inicial para não deixar o app vazio
            db.get(`SELECT COUNT(*) as count FROM volunteers`, (err, row) => {
                if (!err && row && row.count === 0) {
                    const insertVol = db.prepare(`INSERT INTO volunteers (name, email, skills, status) VALUES (?, ?, ?, ?)`);
                    insertVol.run("Administrador Central", "admin@greensocial.org", "Gestão do Sistema", "Ativo");
                    insertVol.run("Maria Clara", "maria@example.com", "Comunicação, Eventos", "Ativo");
                    insertVol.run("João Pedro", "joao@example.com", "Design, Marketing", "Inativo");
                    insertVol.finalize(() => {
                        // Inserir post semente após os voluntários garantirem os IDs
                        db.get(`SELECT id FROM volunteers WHERE email = 'admin@greensocial.org'`, (err, admin) => {
                            if (admin) {
                                db.run(`INSERT INTO posts (author_id, time, content, likes) VALUES (?, ?, ?, ?)`,
                                    [admin.id, "Início", "Bem-vindo à nova plataforma da comunidade! Agora com banco de dados real e integridade total. 🎉", 10]
                                );
                            }
                        });
                    });
                }
            });
        });
    }
});

module.exports = db;
