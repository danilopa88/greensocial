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

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único do post. |
| `author_id` | INTEGER | FK → `volunteers(id)` **SET NULL** | ID do autor. `NULL` se o usuário foi removido. |
| `time` | TEXT | — | Representação amigável do horário (ex: "Agora"). |
| `content` | TEXT | — | Conteúdo textual da postagem. |
| `likes` | INTEGER | Default: 0 | Contador de curtidas. |
| `created_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data de criação (UTC). |
| `updated_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data da última edição (UTC). |

> **Nota:** Quando o autor é removido, `author_id` fica `NULL` e o sistema exibe **"Usuário Removido"** no feed. O post é **preservado**.

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

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único do comentário. |
| `post_id` | INTEGER | FK → `posts(id)` CASCADE | Post ao qual pertence. |
| `author_id` | INTEGER | FK → `volunteers(id)` **SET NULL** | ID do autor. `NULL` se o usuário foi removido. |
| `text` | TEXT | NOT NULL | Conteúdo do comentário. |
| `created_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data de criação (UTC). |
| `updated_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data da última edição (UTC). |

> **Nota:** Quando o autor é removido, o comentário é **preservado** e exibido como **"Usuário Removido"**.

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

### 7. `deletion_audit` (Log de Exclusões)
Registra todas as exclusões manuais realizadas no sistema para rastreamento e auditoria de segurança.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | INTEGER | Chave Primária (Auto-incremento). |
| `table_name` | TEXT | Nome da tabela onde ocorreu a exclusão (ex: `volunteers`, `posts`, `comments`). |
| `record_id` | INTEGER | ID do registro que foi removido. |
| `deletion_date` | DATETIME | Data e hora da exclusão (UTC). |

> **Nota:** Este log não armazena o conteúdo do registro, apenas o identificador e o momento da exclusão. Para recuperação de dados, utilize os backups diários em `/backups`.

---

## 🔗 Relacionamentos (Foreign Keys)

| Tabela | Coluna | Referência | Comportamento na deleção |
| :--- | :--- | :--- | :--- |
| `posts` | `author_id` | `volunteers(id)` | **SET NULL** – post preservado |
| `post_media` | `post_id` | `posts(id)` | CASCADE – mídia removida com o post |
| `comments` | `post_id` | `posts(id)` | CASCADE – comentário removido com o post |
| `comments` | `author_id` | `volunteers(id)` | **SET NULL** – comentário preservado |
| `post_likes` | `post_id` | `posts(id)` | CASCADE – curtida removida com o post |
| `post_likes` | `volunteer_id` | `volunteers(id)` | CASCADE – curtida removida com o usuário |
| `user_access` | `volunteer_id` | `volunteers(id)` | CASCADE – histórico de acesso removido |
