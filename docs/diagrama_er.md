# 📊 Diagrama Entidade-Relacionamento (DER) - Greensocial

Este documento descreve o modelo lógico e as relações entre as tabelas do sistema.

## 🧜‍♂️ Diagrama (Mermaid)

```mermaid
erDiagram
    VOLUNTEERS ||--o{ POSTS : "escreve"
    VOLUNTEERS ||--o{ COMMENTS : "comenta"
    VOLUNTEERS ||--o{ POST_LIKES : "curte"
    VOLUNTEERS ||--o{ USER_ACCESS : "acessa"
    VOLUNTEERS ||--o{ EMAIL_LOGS : "dispara"
    
    POSTS ||--o{ POST_MEDIA : "contém"
    POSTS ||--o{ COMMENTS : "recebe"
    POSTS ||--o{ POST_LIKES : "recebe"

    DELETION_AUDIT }|--|| VOLUNTEERS : "audita (indireto)"

    VOLUNTEERS {
        int id PK
        string name
        string email UK
        string status
        int email_opt_out
    }

    POSTS {
        int id PK
        int author_id FK
        text content
        datetime created_at
    }

    COMMENTS {
        int id PK
        int post_id FK
        int author_id FK
        text text
    }

    POST_MEDIA {
        int id PK
        int post_id FK
        string url
        string type
    }

    POST_LIKES {
        int post_id PK, FK
        int volunteer_id PK, FK
    }

    USER_ACCESS {
        int id PK
        int volunteer_id FK
        string login_time
        string logoff_time
    }

    EMAIL_LOGS {
        int id PK
        int sent_by FK
        string subject
        int recipients_count
    }
```

## 🧠 Explicação do Modelo

### 1. Centralidade do Voluntário
A tabela `volunteers` é o núcleo do sistema. Quase todas as outras tabelas se relacionam com ela (Autor de post, autor de comentário, quem logou, quem disparou e-mail).

### 2. Integridade Referencial
O modelo utiliza dois comportamentos principais para garantir que o banco não fique "sujo":
- **CASCADE**: Se um `Post` é excluído, suas `Mídias`, `Comentários` e `Curtidas` somem automaticamente.
- **SET NULL**: Se um `Voluntário` é excluído, seus `Posts` e `Comentários` permanecem no sistema, mas o campo de autor fica vazio (exibindo "Usuário Removido" na interface). Isso preserva o histórico da comunidade.

### 3. Normalização
- **N:N (Muitos para Muitos)**: A relação entre Voluntários e Posts para curtidas é resolvida na tabela `post_likes`. Ela garante que um voluntário não curta o mesmo post duas vezes (Primary Key composta).
- **1:N (Um para Muitos)**: Um post pode ter várias imagens/vídeos através da tabela `post_media`.

## 📈 Tipo de Banco de Dados
- **Tipo**: Relacional / OLTP (Online Transactional Processing).
- **Propriedades**: ACID (Atomicidade, Consistência, Isolamento e Durabilidade).
- **Motor**: SQLite 3.
