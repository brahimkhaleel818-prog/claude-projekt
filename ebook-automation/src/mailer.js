import nodemailer from 'nodemailer';

export function createMailer(env) {
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) {
    if (!env[key]) throw new Error(`${key} fehlt`);
  }
  const port = Number(env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return {
    verify: () => transport.verify(),
    send: ({ to, subject, html, text, attachment }) =>
      transport.sendMail({
        from: env.MAIL_FROM,
        replyTo: env.MAIL_REPLY_TO || undefined,
        bcc: env.MAIL_BCC || undefined,
        to,
        subject,
        html,
        text,
        attachments: [{ filename: attachment.name, content: attachment.content, contentType: 'application/pdf' }],
      }),
  };
}
