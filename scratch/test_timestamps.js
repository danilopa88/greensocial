const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Testando atualização de timestamps...');

db.get('SELECT id, content, updated_at FROM posts LIMIT 1', (err, post) => {
    if (err || !post) {
        console.error('Nenhum post encontrado para teste.');
        return;
    }
    console.log('Post original:', post);

    const newContent = post.content + ' (editado)';
    db.run('UPDATE posts SET content=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [newContent, post.id], function(err) {
        if (err) {
            console.error('Erro ao atualizar post:', err.message);
            return;
        }
        
        db.get('SELECT id, content, updated_at FROM posts WHERE id=?', [post.id], (err, updatedPost) => {
            console.log('Post atualizado:', updatedPost);
            if (updatedPost.updated_at !== post.updated_at) {
                console.log('✅ updated_at mudou corretamente.');
            } else {
                console.log('❌ updated_at NÃO mudou.');
            }
        });
    });
});
