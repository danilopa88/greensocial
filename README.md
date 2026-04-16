# 🍃 Greensocial

**Greensocial** é uma plataforma moderna e intuitiva de gestão para comunidades de voluntários. O projeto oferece um feed social interativo, painel administrativo, gestão de voluntários, sistema de e-mails com métricas e um repositório robusto de segurança e auditoria.

---

## 🚀 Funcionalidades

### Feed Social
- **Publicações com mídia**: Textos, fotos e vídeos com redimensionamento inteligente.
- **Comentários e Curtidas**: Engajamento real entre os voluntários.
- **Gerenciamento de Conteúdo**: Menu de opções (três pontos) para **Editar** e **Excluir** posts e comentários próprios (admins podem moderar qualquer conteúdo).

### Mensagens Privadas (Chat)
- **Comunicação Direta**: Troca de mensagens entre voluntários pela interface estilo "Web Messenger".
- **Tempo Real**: Atualização instantânea com notificações ("badge") de mensagens não lidas.
- **Edição e Exclusão**: Autores podem rever e deletar suas mensagens a qualquer momento.
- **Criptografia Data-at-Rest (AES-256)**: Todas as mensagens são armazenadas no banco de forma encriptada usando uma chave mestra exclusiva, blindando as informações caso haja cópia indevida do banco de dados.

### Gestão de Voluntários (Admin)
- **Painel CRUD completo**: Cadastrar, editar, desativar e remover membros.
- **Campos**: Nome, e-mail, telefone, data de nascimento, habilidades e status.
- **Exportação XLSX**: Gere relatórios em formato Excel com um clique.
- **Perfis Customizados**: Upload de foto de perfil com **recorte circular** (Cropper.js).

### Sistema de E-mail (Brevo)
- **Boas-vindas automáticas**: E-mail enviado ao cadastrar um novo voluntário.
- **Aviso de Inativação**: Notificação automática ao desativar uma conta.
- **Comunicados (Newsletter)**: Envio de avisos para todos os voluntários **Ativos** pelo painel Admin.
- **Relatório Semanal**: Enviado toda segunda-feira às 08h00 para o e-mail do administrador, incluindo KPIs de e-mail e resumo da base.
- **KPIs no Relatório** (requer `api_key` do Brevo):
  - Taxa de Entrega, Abertura, Clique (CTR), CTOR
  - Taxa de Rejeição, Descadastro e Spam
- **Opt-out de E-mail**: Campo `email_opt_out` na tabela `volunteers` — voluntários com esse campo ativo não recebem newsletters.
- **Log de Comunicados**: Tabela `email_logs` registra assunto, remetente, nº de destinatários, messageIds e data de envio.

### Segurança e Auditoria
- **XSS Prevention**: Sanitização em todas as exibições do frontend.
- **SQL Sanitized**: Todas as consultas protegidas contra SQL Injection.
- **Auditoria de Acessos**: Tabela `user_access` — registra Login e Logoff de cada voluntário.
- **Log de Exclusões**: Tabela `deletion_audit` — registra toda exclusão de posts, comentários e voluntários.
- **Proteção de Mídia**: Remove arquivos de avatar antigos automaticamente.

### Backup e Dados
- **Backup automático diário**: Cópia do banco às 00h00.
- **Retenção de 7 dias**: Mantém os últimos 7 backups em `/backups`.

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3 (Vanilla), JavaScript ES6+ |
| UI Libs | FontAwesome, Cropper.js, SheetJS |
| Backend | Node.js, Express |
| Segurança | Helmet (CSP, XSS Headers), AES-256-CBC (Crypto) |
| Banco de Dados | SQLite3 |
| Uploads | Multer (diretórios dinâmicos por ID) |
| E-mail | Nodemailer (SMTP) + **@getbrevo/brevo API v3** |
| Agendamento | Node-cron (backup + relatório semanal) |
| Build | pkg (executável Windows `.exe`) |

---

## ⚙️ Configuração de E-mail (`email.config.json`)

O arquivo `email.config.json` deve estar **na mesma pasta do executável** (ou na raiz do projeto em modo dev). **Nunca versione este arquivo** — ele está no `.gitignore`.

Use `email.config.example.json` como modelo:

```json
{
  "host": "smtp-relay.brevo.com",
  "port": 587,
  "user": "SEU_LOGIN_SMTP_BREVO",
  "pass": "SUA_CHAVE_SMTP",
  "api_key": "SUA_API_KEY_BREVO",
  "from_name": "Greensocial",
  "from_email": "seu@email.com",
  "admin_email": "admin@email.com"
}
```

| Campo | Obrigatório | Onde obter |
|---|---|---|
| `user` / `pass` | Sim (envio SMTP) | Brevo → Settings → SMTP & API → aba SMTP |
| `api_key` | Sim (métricas) | Brevo → Settings → SMTP & API → aba API Keys |
| `from_email` | Sim | E-mail verificado no Brevo |
| `admin_email` | Sim | E-mail que receberá o relatório semanal |

> **Sem `api_key`**: o sistema envia e-mails normalmente via SMTP, mas o relatório semanal não inclui os KPIs de métricas.

---

## 📦 Como Instalar e Rodar

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado

### Modo Desenvolvedor

```bash
# 1. Instale as dependências
npm install

# 2. Inicie o servidor
npm start

# Ou com hot-reload (desenvolvimento)
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

### Gerar Executável para Windows

```bash
npm run build
```

O arquivo `greensocial.exe` será gerado na raiz do projeto. Para distribuir, copie junto:
- `greensocial.exe`
- `email.config.json` (com suas credenciais)

---

## 🗃️ Estrutura do Banco de Dados

| Tabela | Descrição |
|---|---|
| `volunteers` | Cadastro de voluntários (inclui `email_opt_out`) |
| `posts` | Publicações do feed |
| `post_media` | Mídias vinculadas a posts |
| `post_likes` | Curtidas únicas por usuário |
| `comments` | Comentários nos posts |
| `user_access` | Auditoria de login/logoff |
| `deletion_audit` | Log de todas as exclusões |
| `email_logs` | Histórico de comunicados enviados |
| `messages` | Mensagens do Chat Privado (Conteúdo encriptografado) |

---

## 🛡️ Segurança

- **Credenciais nunca no código**: configuradas em arquivo externo (`.gitignore`'d).
- **Helmet**: define cabeçalhos HTTP de segurança.
- **Prepared Statements**: previnem SQL Injection em 100% das queries.
- **Escape HTML**: previne XSS em todo conteúdo renderizado no frontend.
- **Data-at-Rest Encryption**: Mensagens de chat blindadas no banco de dados local com AES-256.

---

## 📁 Arquivos Ignorados pelo Git

```
uploads/          → Mídias dos usuários
node_modules/     → Dependências
backups/          → Backups do banco
database.sqlite   → Banco de dados local
greensocial.exe   → Executável compilado
email.config.json → Credenciais de e-mail (SENSÍVEL)
greensocial.key   → Chave Mestra AES-256 (MUITO SENSÍVEL)
```

---

Desenvolvido com ❤️ para fortalecer comunidades de voluntários.
