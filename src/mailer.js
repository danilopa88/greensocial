const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Resolve config path: next to .exe in production, or project root in dev
const externalDir = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
const configPath = path.join(externalDir, 'email.config.json');

let config = null;
let transporter = null;

function loadConfig() {
    if (!fs.existsSync(configPath)) {
        console.warn('⚠️  email.config.json não encontrado. E-mails desativados.');
        return false;
    }
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config.pass || config.pass === 'COLOQUE_SUA_CHAVE_SMTP_AQUI') {
            console.warn('⚠️  Chave SMTP não configurada em email.config.json. E-mails desativados.');
            return false;
        }
        transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: false,
            auth: { user: config.user, pass: config.pass }
        });
        console.log('✅  Serviço de e-mail (Brevo) configurado com sucesso.');
        return true;
    } catch (err) {
        console.error('Erro ao carregar email.config.json:', err.message);
        return false;
    }
}

const ready = loadConfig();

function sender() {
    return `"${config.from_name}" <${config.from_email}>`;
}

function getAdminEmail() {
    return config ? config.admin_email : null;
}

// ── HTML Templates ─────────────────────────────────────────────────────────────

function baseLayout(title, accentColor, headerEmoji, content) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#16a34a 0%,#22c55e 100%);padding:36px 40px;text-align:center;">
          <div style="font-size:2.5rem;margin-bottom:8px;">${headerEmoji}</div>
          <h1 style="color:white;margin:0;font-size:1.6rem;font-weight:700;letter-spacing:-0.5px;">Greensocial</h1>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:0.9rem;">${title}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#94a3b8;font-size:0.78rem;margin:0;">Este é um e-mail automático da plataforma Greensocial. Por favor, não responda.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function welcomeTemplate(name) {
    const content = `
    <h2 style="color:#1e293b;font-size:1.3rem;margin:0 0 16px;">Seja bem-vindo(a), ${name}! 🎉</h2>
    <p style="color:#475569;line-height:1.8;margin:0 0 16px;">Sua conta na plataforma <strong style="color:#22c55e;">Greensocial</strong> foi criada com sucesso. Você agora faz parte da nossa comunidade de voluntários!</p>
    <p style="color:#475569;line-height:1.8;margin:0 0 28px;">Acesse a plataforma com o seu e-mail cadastrado e comece a interagir com a rede.</p>
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:16px 20px;">
      <p style="color:#166534;margin:0;font-size:0.9rem;">💡 <strong>Dica:</strong> Em caso de dúvidas, entre em contato com o administrador da plataforma.</p>
    </div>`;
    return baseLayout('Bem-vindo(a) à rede!', '#22c55e', '🌿', content);
}

function deactivationTemplate(name) {
    const content = `
    <h2 style="color:#1e293b;font-size:1.3rem;margin:0 0 16px;">Olá, ${name}</h2>
    <p style="color:#475569;line-height:1.8;margin:0 0 16px;">Informamos que sua conta na plataforma <strong style="color:#22c55e;">Greensocial</strong> foi <strong style="color:#ef4444;">desativada</strong> por um administrador.</p>
    <p style="color:#475569;line-height:1.8;margin:0 0 28px;">Enquanto sua conta estiver inativa, o acesso à plataforma estará bloqueado.</p>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;">
      <p style="color:#991b1b;margin:0;font-size:0.9rem;">⚠️ Se acredita que isso foi um erro, entre em contato com o administrador da plataforma.</p>
    </div>`;
    return baseLayout('Atualização de Conta', '#ef4444', '🔔', content);
}

function newsletterTemplate(message) {
    const htmlMessage = message.replace(/\n/g, '<br>');
    const content = `
    <div style="color:#334155;line-height:1.9;font-size:1rem;">${htmlMessage}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;">
    <p style="color:#94a3b8;font-size:0.82rem;margin:0;">Você está recebendo este comunicado por ser um voluntário cadastrado na plataforma Greensocial.</p>`;
    return baseLayout('Comunicado da Comunidade', '#22c55e', '📢', content);
}

function weeklyReportTemplate(volunteers) {
    const active = volunteers.filter(v => v.status === 'Ativo');
    const inactive = volunteers.filter(v => v.status === 'Inativo');
    const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const rows = volunteers.map(v => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-weight:500;">${v.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:0.87rem;">${v.email}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">
        <span style="padding:3px 10px;border-radius:999px;font-size:0.78rem;font-weight:600;background:${v.status === 'Ativo' ? '#dcfce7' : '#fee2e2'};color:${v.status === 'Ativo' ? '#166534' : '#991b1b'};">${v.status}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:0.83rem;">${v.skills || '—'}</td>
    </tr>`).join('');

    const content = `
    <p style="color:#64748b;font-size:0.9rem;margin:0 0 24px;">Gerado em: ${dateStr}</p>
    <!-- Stats -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td width="33%" style="text-align:center;padding:20px;background:#f0fdf4;border-radius:12px;">
          <div style="font-size:2rem;font-weight:700;color:#22c55e;">${volunteers.length}</div>
          <div style="color:#475569;font-size:0.85rem;margin-top:4px;">Total</div>
        </td>
        <td width="4%"></td>
        <td width="33%" style="text-align:center;padding:20px;background:#dcfce7;border-radius:12px;">
          <div style="font-size:2rem;font-weight:700;color:#16a34a;">${active.length}</div>
          <div style="color:#475569;font-size:0.85rem;margin-top:4px;">Ativos</div>
        </td>
        <td width="4%"></td>
        <td width="33%" style="text-align:center;padding:20px;background:#fee2e2;border-radius:12px;">
          <div style="font-size:2rem;font-weight:700;color:#dc2626;">${inactive.length}</div>
          <div style="color:#475569;font-size:0.85rem;margin-top:4px;">Inativos</div>
        </td>
      </tr>
    </table>
    <!-- Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:0.88rem;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em;">Nome</th>
          <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em;">E-mail</th>
          <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
          <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em;">Habilidades</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

    return baseLayout('Relatório Semanal de Voluntários', '#22c55e', '📊', content);
}

// ── Send Functions ─────────────────────────────────────────────────────────────

async function sendWelcomeEmail(name, email) {
    if (!ready) return;
    try {
        await transporter.sendMail({
            from: sender(),
            to: email,
            subject: `Bem-vindo(a) à Greensocial, ${name}! 🌿`,
            html: welcomeTemplate(name)
        });
        console.log(`✉️  Boas-vindas enviado → ${email}`);
    } catch (err) {
        console.error('Erro ao enviar boas-vindas:', err.message);
    }
}

async function sendDeactivationEmail(name, email) {
    if (!ready) return;
    try {
        await transporter.sendMail({
            from: sender(),
            to: email,
            subject: 'Atualização sobre sua conta Greensocial',
            html: deactivationTemplate(name)
        });
        console.log(`✉️  Aviso de inativação enviado → ${email}`);
    } catch (err) {
        console.error('Erro ao enviar aviso de inativação:', err.message);
    }
}

async function sendNewsletter(recipients, subject, message) {
    if (!ready) return { success: false, reason: 'Serviço de e-mail não configurado.' };
    let sent = 0, failed = 0;
    for (const r of recipients) {
        try {
            await transporter.sendMail({
                from: sender(),
                to: r.email,
                subject,
                html: newsletterTemplate(message)
            });
            sent++;
        } catch (err) {
            console.error(`Erro ao enviar para ${r.email}:`, err.message);
            failed++;
        }
    }
    console.log(`✉️  Newsletter concluída: ${sent} enviados, ${failed} falhas.`);
    return { success: true, sent, failed };
}

async function sendWeeklyReport(volunteers) {
    if (!ready) return;
    const adminEmail = getAdminEmail();
    if (!adminEmail) return console.warn('⚠️  admin_email não definido em email.config.json.');
    try {
        await transporter.sendMail({
            from: sender(),
            to: adminEmail,
            subject: `📊 Relatório Semanal Greensocial — ${new Date().toLocaleDateString('pt-BR')}`,
            html: weeklyReportTemplate(volunteers)
        });
        console.log(`✉️  Relatório semanal enviado → ${adminEmail}`);
    } catch (err) {
        console.error('Erro ao enviar relatório semanal:', err.message);
    }
}

module.exports = { sendWelcomeEmail, sendDeactivationEmail, sendNewsletter, sendWeeklyReport };
