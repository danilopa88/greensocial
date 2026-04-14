# 🍃 Greensocial

**Greensocial** é uma plataforma moderna e intuitiva de gestão para comunidades de voluntários. O projeto oferece um feed social interativo, painel administrativo para gestão de membros, armazenamento organizado de arquivos e um sistema robusto de segurança e auditoria.

## 🚀 Funcionalidades

-   **Feed Social Interativo**: Publique textos, fotos e vídeos para a comunidade com redimensionamento inteligente.
-   **Sistema de Comentários e Curtidas**: Engajamento real entre os voluntários.
-   **Gestão Profissional de Comentários**: Menu de opções (três pontos) para **Editar** e **Excluir** seus próprios comentários.
-   **Perfis Customizados**: Upload de fotos de perfil com sistema de **recorte circular** (Cropper.js).
-   **Segurança Blindada**: Proteção nativa contra ataques de **SQL Injection** e **XSS** (Cross-Site Scripting).
-   **Auditoria de Acessos**: Registro completo de **Login e Logoff** dos usuários para controle administrativo.
-   **Gestão de Voluntários**: Painel administrativo para cadastrar, editar e remover membros (Exclusivo para ADMIN).
-   **Exportação Inteligente**: Gere relatórios em formato Excel (.xlsx) dos voluntários com um clique.
-   **Organização de Arquivos**: Mídias organizadas automaticamente em subpastas por usuário (`ID/profile` e `ID/posts`).
-   **Backup Automático Diário**: Sistema de proteção que realiza cópias de segurança do banco de dados a cada 24 horas.

## 🛠️ Tecnologias Utilizadas

-   **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+), **Cropper.js**.
-   **Backend**: Node.js, Express, **Helmet** (Segurança).
-   **Banco de Dados**: SQLite3 com persistência real.
-   **Uploads**: Multer com diretórios dinâmicos.
-   **Binários**: **pkg** (gera executável direto para Windows).
-   **Agendamento**: Node-cron (Backups).

## 📦 Como Instalar e Rodar

### Modo Desenvolvedor
1.  **Pré-requisitos**: Tenha o [Node.js](https://nodejs.org/) instalado.
2.  **Instale as dependências**:
    ```bash
    npm install
    ```
3.  **Inicie o servidor**:
    ```bash
    npm start
    ```

### Modo Executável (Windows)
Se você já possui o arquivo `greensocial.exe`, basta executá-lo. O sistema criará automaticamente as pastas de banco de dados e uploads necessárias.

## 🛡️ Segurança e Auditoria

O Greensocial foi construído com foco em integridade:
- **XSS Prevention**: Filtro de sanitização em todas as exibições do frontend.
- **SQL Sanitized**: Todas as consultas são protegidas contra injeção de código.
- **Tabela de Auditoria**: Acesse a tabela `user_access` para verificar horários de entrada e saída dos voluntários.
- **Proteção de Mídia**: O servidor remove automaticamente arquivos de avatar antigos para otimizar o armazenamento.

## 💾 Sistema de Backup

- **Frequência**: Diária (00:00).
- **Retenção**: Mantém os últimos **7 dias**.
- **Localização**: Pasta `/backups` na raiz.

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---
Desenvolvido com ❤️ para fortalecer comunidades de voluntários.
