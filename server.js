const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Importar Helmet para segurança
const multer = require('multer');
const path = require('path');
const db = require('./src/database'); 
const fs = require('fs');
const cron = require('node-cron');
const { initBackupScheduler } = require('./src/backup');
const mailer = require('./src/mailer');

// Configuração de diretórios para o executável (pkg)
const internalDir = __dirname;
const externalDir = process.pkg ? path.dirname(process.execPath) : __dirname;

const uploadsDir = path.join(externalDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Inicializa o sistema de backup diário
initBackupScheduler();

// Relatório semanal automático: toda segunda-feira às 08:00
cron.schedule('0 8 * * 1', () => {
    console.log('📊 Enviando relatório semanal por e-mail...');
    db.all('SELECT * FROM volunteers', (err, rows) => {
        if (!err && rows) mailer.sendWeeklyReport(rows);
    });
});

const app = express();

// Configurar Cabeçalhos de Segurança
app.use(helmet({
    contentSecurityPolicy: false, // Desabilitado temporariamente para não bloquear fontes/imagens externas
    crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(express.json());

// Serve a pasta public como raiz
app.use(express.static(path.join(internalDir, 'public')));

// Serve a pasta de uploads
app.use('/uploads', express.static(uploadsDir));

// --- CONFIGURAÇÃO DE STORAGE DINÂMICO PARA POSTS ---
const postStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const authorId = req.body.author_id || 'anonymous';
        const targetDir = path.join(uploadsDir, authorId.toString(), 'posts');
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, ''));
    }
});
const upload = multer({ storage: postStorage });

// --- CONFIGURAÇÃO DE STORAGE PARA AVATARES ---
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.params.id || 'anonymous';
        const targetDir = path.join(uploadsDir, userId.toString(), 'profile');
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `avatar-${Date.now()}${ext}`);
    }
});
const avatarUpload = multer({ storage: avatarStorage });

// === ROTAS DE VOLUNTÁRIOS ===
app.get('/api/volunteers', (req, res) => {
    db.all('SELECT * FROM volunteers', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/volunteers', (req, res) => {
    const { name, email, skills, status, phone, birth_date } = req.body;
    db.run('INSERT INTO volunteers (name, email, skills, status, phone, birth_date) VALUES (?, ?, ?, ?, ?, ?)', [name, email, skills, status, phone || null, birth_date || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // Envia e-mail de boas-vindas ao novo voluntário
        if (email) mailer.sendWelcomeEmail(name, email);
        res.json({ id: this.lastID, name, email, skills, status, phone, birth_date });
    });
});

app.put('/api/volunteers/:id', (req, res) => {
    const { name, email, skills, status, phone, birth_date } = req.body;
    // Verifica status anterior para acionar notificação de inativação
    db.get('SELECT status, email, name FROM volunteers WHERE id = ?', [req.params.id], (err, old) => {
        db.run('UPDATE volunteers SET name=?, email=?, skills=?, status=?, phone=?, birth_date=? WHERE id=?', [name, email, skills, status, phone || null, birth_date || null, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            // Envia aviso se conta foi desativada
            if (!err && old && old.status === 'Ativo' && status === 'Inativo') {
                mailer.sendDeactivationEmail(name || old.name, email || old.email);
            }
            res.json({ success: true });
        });
    });
});

app.post('/api/volunteers/:id/avatar', avatarUpload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    
    const userId = req.params.id;
    const newAvatarUrl = `/uploads/${userId}/profile/${req.file.filename}`;

    db.get('SELECT avatar_url FROM volunteers WHERE id = ?', [userId], (err, row) => {
        if (!err && row && row.avatar_url) {
            if (row.avatar_url.startsWith('/uploads/')) {
                const oldFilePath = path.join(externalDir, row.avatar_url);
                if (fs.existsSync(oldFilePath)) {
                    try {
                        fs.unlinkSync(oldFilePath);
                    } catch (e) {
                        console.error('Erro ao deletar foto antiga:', e.message);
                    }
                }
            }
        }

        db.run('UPDATE volunteers SET avatar_url = ? WHERE id = ?', [newAvatarUrl, userId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, avatarUrl: newAvatarUrl });
        });
    });
});

app.delete('/api/volunteers/:id', (req, res) => {
    const id = req.params.id;
    // Auditoria: Salvando ID antes da remoção
    db.run('INSERT INTO deletion_audit (table_name, record_id) VALUES (?, ?)', ['volunteers', id], (err) => {
        if (err) console.error('Erro ao auditar deleção:', err.message);
        
        db.run('DELETE FROM volunteers WHERE id=?', id, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// === ROTAS DE POSTAGENS ===
app.get('/api/posts', (req, res) => {
    const userId = parseInt(req.query.user_id, 10) || 0;
    
    // PREVENÇÃO DE SQL INJECTION: Usando ? placeholder para o userId
    const postsQuery = `
        SELECT p.*, COALESCE(v.name, 'Usuário Removido') as author, v.email as author_email, v.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND volunteer_id = ?) as liked_by_me
        FROM posts p 
        LEFT JOIN volunteers v ON p.author_id = v.id 
        ORDER BY p.id DESC
    `;
    
    db.all(postsQuery, [userId], (err, posts) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all('SELECT * FROM post_media', (err, media) => {
            const commentsQuery = `
                SELECT c.*, COALESCE(v.name, 'Usuário Removido') as author, v.email as author_email, v.avatar_url as author_avatar 
                FROM comments c 
                LEFT JOIN volunteers v ON c.author_id = v.id
            `;
            
            db.all(commentsQuery, (err, comments) => {
                const combined = posts.map(p => ({
                    ...p,
                    media_items: media.filter(m => m.post_id === p.id).map(m => ({ url: m.url, type: m.type })),
                    comments: comments.filter(c => c.post_id === p.id).map(c => ({ 
                        id: c.id, 
                        author: c.author, 
                        author_email: c.author_email,
                        author_avatar: c.author_avatar,
                        text: c.text 
                    }))
                }));
                res.json(combined);
            });
        });
    });
});

app.post('/api/posts', upload.array('media'), (req, res) => {
    const { author_id, content } = req.body;
    db.run('INSERT INTO posts (author_id, content) VALUES (?, ?)', [author_id, content || ''], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const postId = this.lastID;
        
        if (req.files && req.files.length > 0) {
            const stmt = db.prepare('INSERT INTO post_media (post_id, url, type) VALUES (?, ?, ?)');
            req.files.forEach(f => {
                const type = f.mimetype.startsWith('video/') ? 'video' : 'image';
                const url = `/uploads/${author_id}/posts/${f.filename}`; 
                stmt.run(postId, url, type);
            });
            stmt.finalize();
        }
        res.json({ success: true, id: postId });
    });
});

app.put('/api/posts/:id', (req, res) => {
    const { content } = req.body;
    db.run('UPDATE posts SET content=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [content, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/posts/:id', (req, res) => {
    const id = req.params.id;
    // Auditoria: Salvando ID antes da remoção
    db.run('INSERT INTO deletion_audit (table_name, record_id) VALUES (?, ?)', ['posts', id], (err) => {
        if (err) console.error('Erro ao auditar deleção:', err.message);

        db.run('DELETE FROM posts WHERE id=?', id, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

app.post('/api/posts/:id/toggle-like', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'ID do usuário é obrigatório.' });

    db.get('SELECT * FROM post_likes WHERE post_id = ? AND volunteer_id = ?', [req.params.id, user_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            db.run('DELETE FROM post_likes WHERE post_id = ? AND volunteer_id = ?', [req.params.id, user_id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                db.run('UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?', [req.params.id]);
                res.json({ success: true, action: 'unliked' });
            });
        } else {
            db.run('INSERT INTO post_likes (post_id, volunteer_id) VALUES (?, ?)', [req.params.id, user_id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [req.params.id]);
                res.json({ success: true, action: 'liked' });
            });
        }
    });
});

app.post('/api/posts/:id/comments', (req, res) => {
    const { author_id, text } = req.body;
    db.run('INSERT INTO comments (post_id, author_id, text) VALUES (?, ?, ?)', [req.params.id, author_id, text], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/comments/:id', (req, res) => {
    const { text } = req.body;
    db.run('UPDATE comments SET text=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [text, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/comments/:id', (req, res) => {
    const id = req.params.id;
    // Auditoria: Salvando ID antes da remoção
    db.run('INSERT INTO deletion_audit (table_name, record_id) VALUES (?, ?)', ['comments', id], (err) => {
        if (err) console.error('Erro ao auditar deleção:', err.message);

        db.run('DELETE FROM comments WHERE id=?', id, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// === ROTAS DE E-MAIL ===
app.post('/api/email/newsletter', async (req, res) => {
    const { subject, message, sent_by } = req.body;
    if (!subject || !message) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }
    // Busca voluntários ativos que NÃO cancelaram o e-mail
    db.all('SELECT id, name, email FROM volunteers WHERE status = ? AND (email_opt_out IS NULL OR email_opt_out = 0)', ['Ativo'], async (err, recipients) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!recipients || recipients.length === 0) {
            return res.json({ success: false, reason: 'Nenhum destinatário disponível.' });
        }
        const result = await mailer.sendNewsletter(recipients, subject, message);
        // Registra no log de e-mails (incluindo messageIds para rastreamento futuro)
        if (result.success) {
            db.run(
                'INSERT INTO email_logs (subject, recipients_count, sent_by, message_ids) VALUES (?, ?, ?, ?)',
                [subject, result.sent, sent_by || null, JSON.stringify(result.messageIds || [])]
            );
        }
        res.json(result);
    });
});

app.get('/api/email/logs', (req, res) => {
    const query = `
        SELECT el.id, el.subject, el.recipients_count, el.sent_at,
               COALESCE(v.name, 'Administrador') as sent_by_name
        FROM email_logs el
        LEFT JOIN volunteers v ON el.sent_by = v.id
        ORDER BY el.sent_at DESC
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/email/weekly-report', (req, res) => {
    db.all('SELECT * FROM volunteers', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        mailer.sendWeeklyReport(rows);
        res.json({ success: true, message: 'Relatório sendo enviado para ' + (rows.length) + ' voluntários...' });
    });
});

app.get('/api/email/stats', async (req, res) => {
    try {
        const stats = await mailer.fetchWeeklyStats();
        if (!stats) return res.json({ available: false, reason: 'API key não configurada ou indisponível.' });
        res.json({ available: true, ...stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === ROTAS DE AUDITORIA DE ACESSO ===
app.post('/api/access/login', (req, res) => {
    const { volunteer_id } = req.body;
    const loginTime = new Date().toLocaleString('pt-BR');
    db.run('INSERT INTO user_access (volunteer_id, login_time) VALUES (?, ?)', [volunteer_id, loginTime], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, accessId: this.lastID });
    });
});

app.put('/api/access/logoff/:id', (req, res) => {
    const logoffTime = new Date().toLocaleString('pt-BR');
    db.run('UPDATE user_access SET logoff_time = ? WHERE id = ?', [logoffTime, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta http://localhost:${PORT}`);
});
