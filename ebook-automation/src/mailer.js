import nodemailer from 'nodemailer';

// Microsoft 365 / Outlook: Versand über die Microsoft Graph API (empfohlen,
// weil Microsoft SMTP mit Passwort abschaltet). Sonst: normales SMTP.
export function createMailer(env) {
  return env.MS_CLIENT_ID ? createGraphMailer(env) : createSmtpMailer(env);
}

const SMALL_ATTACHMENT_LIMIT = 3 * 1024 * 1024;
const UPLOAD_CHUNK = 12 * 320 * 1024; // Graph verlangt Vielfache von 320 KiB

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
  const mailbox = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}`;

  async function graph(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Outlook-Versand fehlgeschlagen (HTTP ${res.status}): ${await res.text()}`);
    return res.status === 202 || res.status === 204 ? null : res.json();
  }

  // Anhänge über 3 MB nimmt Graph nur stückweise über eine Upload-Session an.
  async function uploadLargeAttachment(messageId, attachment) {
    const { uploadUrl } = await graph('POST', `${mailbox}/messages/${messageId}/attachments/createUploadSession`, {
      AttachmentItem: { attachmentType: 'file', name: attachment.filename, size: attachment.content.length, contentType: 'application/pdf' },
    });
    const total = attachment.content.length;
    for (let start = 0; start < total; start += UPLOAD_CHUNK) {
      const chunk = attachment.content.subarray(start, Math.min(start + UPLOAD_CHUNK, total));
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Length': String(chunk.length), 'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${total}` },
        body: chunk,
      });
      if (!res.ok) throw new Error(`Anhang-Upload fehlgeschlagen (HTTP ${res.status}): ${await res.text()}`);
    }
  }

  return {
    async send({ to, subject, html, attachments = [] }) {
      const small = attachments.filter((a) => a.content.length < SMALL_ATTACHMENT_LIMIT);
      const large = attachments.filter((a) => a.content.length >= SMALL_ATTACHMENT_LIMIT);
      const message = {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: recipients(to),
        bccRecipients: recipients(env.MAIL_BCC),
        replyTo: recipients(env.MAIL_REPLY_TO),
        attachments: small.map((a) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.filename,
          contentType: 'application/pdf',
          contentBytes: a.content.toString('base64'),
        })),
      };
      if (!large.length) {
        await graph('POST', `${mailbox}/sendMail`, { message, saveToSentItems: true });
        return;
      }
      // Entwurf anlegen, große Anhänge hochladen, dann senden (landet in "Gesendete Elemente").
      const draft = await graph('POST', `${mailbox}/messages`, message);
      for (const attachment of large) await uploadLargeAttachment(draft.id, attachment);
      await graph('POST', `${mailbox}/messages/${draft.id}/send`);
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
    send: ({ to, subject, html, text, attachments = [] }) =>
      transport.sendMail({
        from: env.MAIL_FROM,
        replyTo: env.MAIL_REPLY_TO || undefined,
        bcc: env.MAIL_BCC || undefined,
        to,
        subject,
        html,
        text,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: 'application/pdf' })),
      }),
  };
}
