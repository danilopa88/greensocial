const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.pkg 
    ? path.join(path.dirname(process.execPath), 'database.sqlite')
    : path.resolve(__dirname, 'database.sqlite');
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
                author_id INTEGER NOT NULL,
                time TEXT,
                content TEXT,
                likes INTEGER DEFAULT 0,
                FOREIGN KEY (author_id) REFERENCES volunteers(id) ON DELETE CASCADE
            )`);

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
                author_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES volunteers(id) ON DELETE CASCADE
            )`);

            // Likes Tracking (Para curtida única por usuário)
            db.run(`CREATE TABLE IF NOT EXISTS post_likes (
                post_id INTEGER NOT NULL,
                volunteer_id INTEGER NOT NULL,
                PRIMARY KEY (post_id, volunteer_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
            )`);

            // Auditoria de Acessos
            db.run(`CREATE TABLE IF NOT EXISTS user_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                volunteer_id INTEGER NOT NULL,
                login_time TEXT NOT NULL,
                logoff_time TEXT,
                FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
            )`);

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
