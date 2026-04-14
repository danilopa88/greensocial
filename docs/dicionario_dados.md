# 📚 Dicionário de Dados - Greensocial

Este documento descreve a estrutura do banco de dados SQLite (`database.sqlite`) utilizado na plataforma Greensocial.

## 🗂️ Tabelas

---

### 1. `volunteers` (Voluntários)
Armazena as informações cadastrais de todos os membros e administradores.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | INTEGER | Chave Primária (Auto-incremento). |
| `name` | TEXT | Nome completo do voluntário. |
| `email` | TEXT | E-mail (Único). Usado para login. |
| `skills` | TEXT | Descrição das habilidades do membro. |
| `status` | TEXT | Estado atual (Ativo/Inativo). |
| `avatar_url` | TEXT | Caminho local para a imagem de perfil. |

---

### 2. `posts` (Postagens do Feed)
Armazena os textos publicados pelos voluntários.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | INTEGER | Chave Primária (Auto-incremento). |
| `author_id` | INTEGER | Chave Estrangeira vinculada a `volunteers(id)`. |
| `time` | TEXT | Representação amigável do horário (ex: "Agora"). |
| `content` | TEXT | Conteúdo textual da postagem. |
| `likes` | INTEGER | Contador de curtidas (Default: 0). |
| `created_at` | DATETIME | Data de criação (UTC). |
| `updated_at` | DATETIME | Data da última edição (UTC). |

---

### 3. `post_media` (Mídias das Postagens)
Armazena os links de fotos e vídeos associados a cada postagem.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | INTEGER | Chave Primária (Auto-incremento). |
| `post_id` | INTEGER | Chave Estrangeira vinculada a `posts(id)`. |
| `url` | TEXT | Caminho local para o arquivo de mídia. |
| `type` | TEXT | Tipo de arquivo (`image` ou `video`). |

---

### 4. `comments` (Comentários)
Armazena as interações textuais nas postagens.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | INTEGER | Chave Primária (Auto-incremento). |
| `post_id` | INTEGER | Chave Estrangeira vinculada a `posts(id)`. |
| `author_id` | INTEGER | Chave Estrangeira vinculada a `volunteers(id)`. |
| `text` | TEXT | Conteúdo do comentário. |
| `created_at` | DATETIME | Data de criação (UTC). |
| `updated_at` | DATETIME | Data da última edição (UTC). |

---

### 5. `post_likes` (Rastreamento de Curtidas)
Tabela de relacionamento para garantir que cada usuário curta um post apenas uma vez.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `post_id` | INTEGER | Chave Estrangeira (Parte da Chave Primária composta). |
| `volunteer_id` | INTEGER | Chave Estrangeira (Parte da Chave Primária composta). |
| `created_at` | DATETIME | Data em que a curtida foi dada. |
| `updated_at` | DATETIME | Timestamp de controle interno. |

---

### 6. `user_access` (Auditoria de Acessos)
Registra o histórico de entradas e saídas do sistema.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | INTEGER | Chave Primária (Auto-incremento). |
| `volunteer_id` | INTEGER | Chave Estrangeira vinculada a `volunteers(id)`. |
| `login_time` | TEXT | Horário formatado de login (Local). |
| `logoff_time` | TEXT | Horário formatado de logoff (Local). |

---

## 🔗 Relacionamentos (Foreign Keys)
- Todas as tabelas possuem a regra `ON DELETE CASCADE`. Ou seja, se um voluntário for deletado, suas postagens, comentários e curtidas serão removidos automaticamente para manter a integridade do banco.
