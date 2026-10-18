import nodemailer from 'nodemailer';

// Microsoft 365 / Outlook: Versand über die Microsoft Graph API (empfohlen,
// weil Microsoft SMTP mit Passwort abschaltet). Sonst: normales SMTP.
export function createMailer(env) {
  return env.MS_CLIENT_ID ? createGraphMailer(env) : createSmtpMailer(env);
}

function requireEnv(env, keys) {
  for (const key of keys) {
    if (!env[key]) throw new Error(`${key} fehlt`);
  }
}

function createGraphMailer(env) {
  requireEnv(env, ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'MAIL_FROM']);
  // MAIL_FROM darf "Eveom <info@eveom.health>" sein – Graph braucht nur die Adresse.
  const sender = env.MAIL_FROM.match(/<([^>]+)>/)?.[1] || env.MAIL_FROM.trim();
  let token = null;

  async function getToken() {
    if (token) return token;
    const res = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.MS_CLIENT_ID,
        client_secret: env.MS_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      }),
    });
    if (!res.ok) throw new Error(`Microsoft-Anmeldung fehlgeschlagen (HTTP ${res.status}): ${await res.text()}`);
    token = (await res.json()).access_token;
    return token;
  }

  const recipients = (address) => (address ? [{ emailAddress: { address } }] : []);

  return {
    async send({ to, subject, html }) {
      const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: html },
            toRecipients: recipients(to),
            bccRecipients: recipients(env.MAIL_BCC),
            replyTo: recipients(env.MAIL_REPLY_TO),
          },
          saveToSentItems: true,
        }),
      });
      if (!res.ok) throw new Error(`Outlook-Versand fehlgeschlagen (HTTP ${res.status}): ${await res.text()}`);
    },
  };
}

function createSmtpMailer(env) {
  requireEnv(env, ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']);
  // 465 = direkt verschlüsselt, 587 (z. B. Outlook) = STARTTLS
  const port = Number(env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return {
    send: ({ to, subject, html, text }) =>
      transport.sendMail({
        from: env.MAIL_FROM,
        replyTo: env.MAIL_REPLY_TO || undefined,
        bcc: env.MAIL_BCC || undefined,
        to,
        subject,
        html,
        text,
      }),
  };
}
