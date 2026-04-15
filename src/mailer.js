const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Resolve config path: next to .exe in production, or project root in dev
const externalDir = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
const configPath = path.join(externalDir, 'email.config.json');

let config = null;
let mode = null;          // 'api' | 'smtp' | null
let brevoApi = null;      // Brevo TransactionalEmailsApi instance
let smtpTransport = null; // Nodemailer SMTP fallback

// ── Config Loader ─────────────────────────────────────────────────────────────
function loadConfig() {
    if (!fs.existsSync(configPath)) {
        console.warn('⚠️  email.config.json não encontrado. E-mails desativados.');
        return;
    }
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        const hasApiKey  = config.api_key && config.api_key !== 'COLOQUE_SUA_API_KEY_AQUI';
        const hasSmtpKey = config.pass && config.pass !== 'COLOQUE_SUA_CHAVE_SMTP_AQUI';

        if (hasApiKey) {
            const { BrevoClient } = require('@getbrevo/brevo');
            brevoApi = new BrevoClient({ apiKey: config.api_key });
            mode = 'api';
            console.log('✅  Serviço de e-mail (Brevo API v3 + Métricas) configurado com sucesso.');
        } else if (hasSmtpKey) {
            smtpTransport = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: false,
                auth: { user: config.user, pass: config.pass }
            });
            mode = 'smtp';
            console.log('✅  Serviço de e-mail (Brevo SMTP) configurado. Adicione api_key para habilitar métricas.');
        } else {
            console.warn('⚠️  Nenhuma credencial configurada em email.config.json. E-mails desativados.');
        }
    } catch (err) {
        console.error('Erro ao carregar email.config.json:', err.message);
    }
}

loadConfig();

// ── Helpers ───────────────────────────────────────────────────────────────────
const isReady = () => mode !== null;
const hasApi  = () => mode === 'api';

async function sendOne(toEmail, toName, subject, html) {
    if (!isReady()) return null;
    try {
        if (hasApi()) {
            const result = await brevoApi.transactionalEmails.sendTransacEmail({
                sender:      { name: config.from_name, email: config.from_email },
                to:          [{ email: toEmail, name: toName || toEmail }],
                subject,
                htmlContent: html
            });
            // A resposta pode estar em result.body ou diretamente em result
            const body = result?.body ?? result;
            return body?.messageId ?? null;
        } else {
            await smtpTransport.sendMail({
                from: `"${config.from_name}" <${config.from_email}>`,
                to: toEmail,
                subject,
                html
            });
            return null;
        }
    } catch (err) {
        console.error(`Erro ao enviar para ${toEmail}:`, err.message);
        return 'ERROR';
    }
}

// ── KPI Fetch from Brevo API ──────────────────────────────────────────────────
async function fetchWeeklyStats() {
    if (!hasApi()) return null;
    try {
        const end   = new Date();
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const fmt   = d => d.toISOString().split('T')[0];

        const result = await brevoApi.transactionalEmails.getAggregatedSmtpReport({
            startDate: fmt(start),
            endDate:   fmt(end)
        });
        const s = result?.body ?? result;

        const requests   = s.requests    || 0;
        const delivered  = s.delivered   || 0;
        const opens      = s.uniqueOpens || 0;
        const clicks     = s.uniqueClicks|| 0;
        const bounces    = (s.hardBounces || 0) + (s.softBounces || 0);
        const unsubs     = s.unsubscribed || 0;
        const spam       = s.spamReports  || 0;

        const pct = (num, den) => den > 0 ? ((num / den) * 100).toFixed(1) + '%' : '—';

        return {
            period: `${fmt(start)} → ${fmt(end)}`,
            requests, delivered, opens, clicks, bounces, unsubs, spam,
            deliverability : pct(delivered, requests),
            openRate       : pct(opens,     delivered),
            clickRate      : pct(clicks,    delivered),
            ctor           : pct(clicks,    opens),
            bounceRate     : pct(bounces,   requests),
            unsubscribeRate: pct(unsubs,    delivered),
            spamRate       : pct(spam,      delivered),
        };
    } catch (err) {
        console.error('Erro ao buscar estatísticas do Brevo:', err.message);
        return null;
    }
}

// ── HTML Templates ─────────────────────────────────────────────────────────────
function baseLayout(title, headerEmoji, content) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#16a34a 0%,#22c55e 100%);padding:36px 40px;text-align:center;">
          <div style="font-size:2.5rem;margin-bottom:8px;">${headerEmoji}</div>
          <h1 style="color:white;margin:0;font-size:1.6rem;font-weight:700;">Greensocial</h1>
          <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:0.9rem;">${title}</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">${content}</td></tr>
        <tr><td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#94a3b8;font-size:0.78rem;margin:0;">E-mail automático da plataforma Greensocial. Por favor, não responda.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function kpiCard(label, value, bg, color) {
    return `<td width="25%" style="text-align:center;padding:16px 8px;background:${bg};border-radius:10px;">
      <div style="font-size:1.4rem;font-weight:700;color:${color};">${value}</div>
      <div style="color:#475569;font-size:0.75rem;margin-top:4px;line-height:1.3;">${label}</div>
    </td>`;
}

function kpiSpacer() {
    return `<td width="2%"></td>`;
}

function kpiSection(stats) {
    if (!stats) return `
    <div style="background:#f8fafc;border-radius:12px;padding:20px;text-align:center;color:#94a3b8;font-size:0.85rem;margin-bottom:28px;">
      <em>Métricas avançadas indisponíveis. Adicione <strong>api_key</strong> do Brevo no email.config.json para ativá-las.</em>
    </div>`;

    return `
    <h3 style="color:#1e293b;font-size:1rem;margin:0 0 12px;font-weight:600;">📊 KPIs dos Últimos 7 Dias <span style="font-weight:400;color:#64748b;font-size:0.82rem;">${stats.period}</span></h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        ${kpiCard('Taxa de<br>Entrega',     stats.deliverability,  '#f0fdf4', '#16a34a')}
        ${kpiSpacer()}
        ${kpiCard('Taxa de<br>Abertura',    stats.openRate,        '#eff6ff', '#2563eb')}
        ${kpiSpacer()}
        ${kpiCard('Taxa de<br>Clique (CTR)',stats.clickRate,       '#fefce8', '#ca8a04')}
        ${kpiSpacer()}
        ${kpiCard('CTOR',                   stats.ctor,            '#f5f3ff', '#7c3aed')}
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        ${kpiCard('Taxa de<br>Rejeição',    stats.bounceRate,      '#fff7ed', '#ea580c')}
        ${kpiSpacer()}
        ${kpiCard('Taxa de<br>Descadastro', stats.unsubscribeRate, '#fef2f2', '#dc2626')}
        ${kpiSpacer()}
        ${kpiCard('Taxa de<br>Spam',        stats.spamRate,        '#fff1f2', '#be123c')}
        ${kpiSpacer()}
        ${kpiCard('Envios<br>Totais',       stats.requests,        '#f8fafc', '#475569')}
      </tr>
    </table>`;
}

function welcomeTemplate(name) {
    const content = `
    <h2 style="color:#1e293b;font-size:1.3rem;margin:0 0 16px;">Seja bem-vindo(a), ${name}! 🎉</h2>
    <p style="color:#475569;line-height:1.8;margin:0 0 16px;">Sua conta na plataforma <strong style="color:#22c55e;">Greensocial</strong> foi criada com sucesso. Você agora faz parte da nossa comunidade de voluntários!</p>
    <p style="color:#475569;line-height:1.8;margin:0 0 28px;">Acesse a plataforma com o seu e-mail cadastrado e comece a interagir com a rede.</p>
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:16px 20px;">
      <p style="color:#166534;margin:0;font-size:0.9rem;">💡 Em caso de dúvidas, entre em contato com o administrador da plataforma.</p>
    </div>`;
    return baseLayout('Bem-vindo(a) à rede!', '🌿', content);
}

function deactivationTemplate(name) {
    const content = `
    <h2 style="color:#1e293b;font-size:1.3rem;margin:0 0 16px;">Olá, ${name}</h2>
    <p style="color:#475569;line-height:1.8;margin:0 0 16px;">Informamos que sua conta na plataforma <strong style="color:#22c55e;">Greensocial</strong> foi <strong style="color:#ef4444;">desativada</strong> por um administrador.</p>
    <p style="color:#475569;line-height:1.8;margin:0 0 28px;">Enquanto sua conta estiver inativa, o acesso à plataforma estará bloqueado.</p>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;">
      <p style="color:#991b1b;margin:0;font-size:0.9rem;">⚠️ Se acredita que isso foi um erro, entre em contato com o administrador da plataforma.</p>
    </div>`;
    return baseLayout('Atualização de Conta', '🔔', content);
}

function newsletterTemplate(message) {
    const htmlMessage = message.replace(/\n/g, '<br>');
    const content = `
    <div style="color:#334155;line-height:1.9;font-size:1rem;">${htmlMessage}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;">
    <p style="color:#94a3b8;font-size:0.82rem;margin:0;">Você está recebendo este comunicado por ser um voluntário cadastrado na plataforma Greensocial.</p>`;
    return baseLayout('Comunicado da Comunidade', '📢', content);
}

function weeklyReportTemplate(volunteers, stats) {
    const active   = volunteers.filter(v => v.status === 'Ativo');
    const inactive = volunteers.filter(v => v.status === 'Inativo');
    const optOut   = volunteers.filter(v => v.email_opt_out);
    const dateStr  = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const rows = volunteers.map(v => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-weight:500;">${v.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:0.87rem;">${v.email}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">
        <span style="padding:3px 10px;border-radius:999px;font-size:0.78rem;font-weight:600;background:${v.status === 'Ativo' ? '#dcfce7' : '#fee2e2'};color:${v.status === 'Ativo' ? '#166534' : '#991b1b'};">${v.status}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:center;">
        ${v.email_opt_out ? '<span style="color:#dc2626;font-size:0.8rem;">Opt-out</span>' : '<span style="color:#16a34a;font-size:0.8rem;">✓</span>'}
      </td>
    </tr>`).join('');

    const content = `
    <p style="color:#64748b;font-size:0.9rem;margin:0 0 24px;">Gerado em: ${dateStr}</p>
    ${kpiSection(stats)}
    <h3 style="color:#1e293b;font-size:1rem;margin:0 0 12px;font-weight:600;">👥 Resumo de Voluntários</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        ${kpiCard('Total',    volunteers.length, '#f0fdf4', '#22c55e')}
        ${kpiSpacer()}
        ${kpiCard('Ativos',   active.length,     '#dcfce7', '#16a34a')}
        ${kpiSpacer()}
        ${kpiCard('Inativos', inactive.length,   '#fee2e2', '#dc2626')}
        ${kpiSpacer()}
        ${kpiCard('Opt-out',  optOut.length,     '#fff7ed', '#ea580c')}
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:0.88rem;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:0.78rem;text-transform:uppercase;">Nome</th>
          <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:0.78rem;text-transform:uppercase;">E-mail</th>
          <th style="padding:10px 14px;text-align:left;color:#64748b;font-size:0.78rem;text-transform:uppercase;">Status</th>
          <th style="padding:10px 14px;text-align:center;color:#64748b;font-size:0.78rem;text-transform:uppercase;">Mailing</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

    return baseLayout('Relatório Semanal de Voluntários', '📊', content);
}

// ── Public Send Functions ──────────────────────────────────────────────────────
async function sendWelcomeEmail(name, email) {
    if (!isReady()) return;
    const id = await sendOne(email, name, `Bem-vindo(a) à Greensocial, ${name}! 🌿`, welcomeTemplate(name));
    if (id !== 'ERROR') console.log(`✉️  Boas-vindas → ${email}`);
}

async function sendDeactivationEmail(name, email) {
    if (!isReady()) return;
    const id = await sendOne(email, name, 'Atualização sobre sua conta Greensocial', deactivationTemplate(name));
    if (id !== 'ERROR') console.log(`✉️  Inativação → ${email}`);
}

async function sendNewsletter(recipients, subject, message) {
    if (!isReady()) return { success: false, reason: 'Serviço de e-mail não configurado.' };
    let sent = 0, failed = 0;
    const messageIds = [];

    for (const r of recipients) {
        const id = await sendOne(r.email, r.name, subject, newsletterTemplate(message));
        if (id === 'ERROR') {
            failed++;
        } else {
            sent++;
            if (id) messageIds.push(id);
        }
    }
    console.log(`✉️  Newsletter: ${sent} enviados, ${failed} falhas.`);
    return { success: true, sent, failed, messageIds };
}

async function sendWeeklyReport(volunteers) {
    if (!isReady()) return;
    const adminEmail = config?.admin_email;
    if (!adminEmail) return console.warn('⚠️  admin_email não definido em email.config.json.');

    // Buscar KPIs do Brevo antes de gerar o relatório
    const stats = await fetchWeeklyStats();
    const html  = weeklyReportTemplate(volunteers, stats);

    const id = await sendOne(
        adminEmail, 'Administrador Greensocial',
        `📊 Relatório Semanal Greensocial — ${new Date().toLocaleDateString('pt-BR')}`,
        html
    );
    if (id !== 'ERROR') console.log(`✉️  Relatório semanal → ${adminEmail}`);
}

module.exports = { sendWelcomeEmail, sendDeactivationEmail, sendNewsletter, sendWeeklyReport, fetchWeeklyStats };
