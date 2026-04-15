# 📚 Dicionário de Dados - Greensocial

Este documento descreve a estrutura do banco de dados SQLite (`database.sqlite`) utilizado na plataforma Greensocial.

---

## 🗂️ Tabelas

---

### 1. `volunteers` (Voluntários)
Armazena as informações cadastrais de todos os membros e administradores.

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único do voluntário. |
| `name` | TEXT | NOT NULL | Nome completo do voluntário. |
| `email` | TEXT | UNIQUE, NOT NULL | E-mail de login. |
| `skills` | TEXT | — | Habilidades do membro (texto livre). |
| `status` | TEXT | — | Estado atual: `Ativo` ou `Inativo`. |
| `avatar_url` | TEXT | — | Caminho local para a imagem de perfil. |
| `phone` | TEXT | — | Telefone no formato `XX-XXXXXXXX` ou `XX-XXXXXXXXX`. |
| `birth_date` | TEXT | — | Data de nascimento no formato `DD/MM/AAAA`. |
| `email_opt_out` | INTEGER | Default: 0 | Preferência de e-mail: `0` = recebe comunicados, `1` = não recebe. |

> **Nota:** `email_opt_out = 1` exclui o voluntário de qualquer envio de newsletter, mesmo que seu status seja `Ativo`.

---

### 2. `posts` (Postagens do Feed)
Armazena os textos publicados pelos voluntários.

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único do post. |
| `author_id` | INTEGER | FK → `volunteers(id)` **SET NULL** | ID do autor. `NULL` se o usuário foi removido. |
| `content` | TEXT | — | Conteúdo textual da postagem. |
| `likes` | INTEGER | Default: 0 | Contador de curtidas (desnormalizado para performance). |
| `created_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data de criação (UTC). |
| `updated_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data da última edição (UTC). |

> **Nota:** Quando o autor é removido, `author_id` fica `NULL` e o sistema exibe **"Usuário Removido"** no feed. O post é **preservado**.

---

### 3. `post_media` (Mídias das Postagens)
Armazena os links de fotos e vídeos associados a cada postagem.

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único da mídia. |
| `post_id` | INTEGER | FK → `posts(id)` CASCADE | Post ao qual a mídia pertence. |
| `url` | TEXT | — | Caminho local para o arquivo de mídia. |
| `type` | TEXT | — | Tipo de arquivo: `image` ou `video`. |

---

### 4. `comments` (Comentários)
Armazena as interações textuais nas postagens.

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único do comentário. |
| `post_id` | INTEGER | FK → `posts(id)` CASCADE | Post ao qual o comentário pertence. |
| `author_id` | INTEGER | FK → `volunteers(id)` **SET NULL** | ID do autor. `NULL` se o usuário foi removido. |
| `text` | TEXT | NOT NULL | Conteúdo do comentário. |
| `created_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data de criação (UTC). |
| `updated_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data da última edição (UTC). |

> **Nota:** Quando o autor é removido, o comentário é **preservado** e exibido como **"Usuário Removido"**.

---

### 5. `post_likes` (Rastreamento de Curtidas)
Tabela de relacionamento para garantir que cada usuário curta um post apenas uma vez.

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `post_id` | INTEGER | PK composta + FK → `posts(id)` CASCADE | Post curtido. |
| `volunteer_id` | INTEGER | PK composta + FK → `volunteers(id)` CASCADE | Voluntário que curtiu. |
| `created_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data em que a curtida foi registrada. |
| `updated_at` | DATETIME | Default: CURRENT_TIMESTAMP | Timestamp de controle interno. |

---

### 6. `user_access` (Auditoria de Acessos)
Registra o histórico completo de entradas e saídas do sistema.

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único do registro. |
| `volunteer_id` | INTEGER | FK → `volunteers(id)` CASCADE | Voluntário que acessou o sistema. |
| `login_time` | TEXT | NOT NULL | Horário formatado do login (fuso local). |
| `logoff_time` | TEXT | — | Horário formatado do logoff (fuso local). `NULL` se sessão ativa. |

---

### 7. `deletion_audit` (Log de Exclusões)
Registra todas as exclusões realizadas no sistema para rastreamento e auditoria de segurança.

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único do registro. |
| `table_name` | TEXT | NOT NULL | Tabela onde ocorreu a exclusão (ex: `volunteers`, `posts`, `comments`). |
| `record_id` | INTEGER | NOT NULL | ID do registro que foi removido. |
| `deletion_date` | DATETIME | Default: CURRENT_TIMESTAMP | Data e hora da exclusão (UTC). |

> **Nota:** Este log armazena apenas a referência (tabela + ID), não o conteúdo. Para recuperação de dados, utilize os backups em `/backups`.

---

### 8. `email_logs` (Log de Comunicados Enviados)
Registra cada comunicado (newsletter) enviado pelo sistema, com rastreabilidade completa do remetente.

| Coluna | Tipo | Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK, Auto-incremento | Identificador único do envio. |
| `subject` | TEXT | NOT NULL | Assunto do comunicado. |
| `recipients_count` | INTEGER | Default: 0 | Número de destinatários que receberam o e-mail com sucesso. |
| `sent_by` | INTEGER | FK → `volunteers(id)` **SET NULL** | ID do administrador que disparou o envio. `NULL` se o usuário foi removido. |
| `message_ids` | TEXT | — | JSON array com os `messageId`s retornados pela API do Brevo para rastreamento individual. |
| `sent_at` | DATETIME | Default: CURRENT_TIMESTAMP | Data e hora do envio (UTC). |

> **Nota:** O relatório semanal automático (segunda-feira, 08h) **não** é registrado em `email_logs` — apenas os comunicados manuais enviados pelo painel Admin.

---

## 🔗 Relacionamentos (Foreign Keys)

| Tabela | Coluna | Referência | Comportamento na deleção |
| :--- | :--- | :--- | :--- |
| `posts` | `author_id` | `volunteers(id)` | **SET NULL** – post preservado |
| `post_media` | `post_id` | `posts(id)` | **CASCADE** – mídia removida com o post |
| `comments` | `post_id` | `posts(id)` | **CASCADE** – comentário removido com o post |
| `comments` | `author_id` | `volunteers(id)` | **SET NULL** – comentário preservado |
| `post_likes` | `post_id` | `posts(id)` | **CASCADE** – curtida removida com o post |
| `post_likes` | `volunteer_id` | `volunteers(id)` | **CASCADE** – curtida removida com o usuário |
| `user_access` | `volunteer_id` | `volunteers(id)` | **CASCADE** – histórico de acesso removido |
| `email_logs` | `sent_by` | `volunteers(id)` | **SET NULL** – log preservado mesmo se admin for removido |

---

## 📝 Histórico de Migrações

| Data | Alteração |
| :--- | :--- |
| Inicial | Criação das tabelas `volunteers`, `posts`, `post_media`, `post_likes`, `comments`. |
| Sprint 2 | Adicionadas colunas `avatar_url`, `phone`, `birth_date` em `volunteers`. |
| Sprint 2 | Adicionadas colunas `created_at`, `updated_at` em `posts`, `comments`, `post_likes`. |
| Sprint 2 | Criadas tabelas `user_access` e `deletion_audit`. |
| Sprint 3 | Alterada FK de `posts.author_id` e `comments.author_id` de `CASCADE` para `SET NULL`. |
| Sprint 3 | Removida coluna `time` de `posts` (substituída por `created_at`). |
| Sprint 4 | Adicionada coluna `email_opt_out` em `volunteers`. |
| Sprint 4 | Criada tabela `email_logs` com suporte a rastreamento via Brevo API (`message_ids`). |
