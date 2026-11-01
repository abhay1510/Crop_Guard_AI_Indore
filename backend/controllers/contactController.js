const nodemailer = require('nodemailer');
const ContactMessage = require('../models/ContactMessage');

const emailOk = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function contactEmailHtml(contact) {
  const name = escapeHtml(contact.name);
  const email = escapeHtml(contact.email);
  const subject = escapeHtml(contact.subject);
  const message = escapeHtml(contact.message).replace(/\r?\n/g, '<br>');
  const receivedAt = escapeHtml(new Date(contact.createdAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }));
  const replySubject = encodeURIComponent(`Re: ${contact.subject}`);

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f1f5f2;font-family:Arial,Helvetica,sans-serif;color:#173326;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f2;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce8df;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:26px 32px;background:#103d2a;color:#ffffff;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#a7f3d0;">CropGuard AI · Contact</p>
            <h1 style="margin:0;font-size:24px;line-height:1.3;">New message received</h1>
          </td></tr>
          <tr><td style="padding:28px 32px 12px;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#41584b;">A visitor sent a message through the CropGuard AI contact form.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr><td style="padding:11px 0;border-bottom:1px solid #e8eee9;width:110px;font-size:12px;font-weight:bold;text-transform:uppercase;color:#708278;">From</td><td style="padding:11px 0;border-bottom:1px solid #e8eee9;font-size:14px;color:#173326;">${name} &lt;${email}&gt;</td></tr>
              <tr><td style="padding:11px 0;border-bottom:1px solid #e8eee9;font-size:12px;font-weight:bold;text-transform:uppercase;color:#708278;">Subject</td><td style="padding:11px 0;border-bottom:1px solid #e8eee9;font-size:14px;font-weight:bold;color:#173326;">${subject}</td></tr>
              <tr><td style="padding:11px 0;font-size:12px;font-weight:bold;text-transform:uppercase;color:#708278;">Received</td><td style="padding:11px 0;font-size:14px;color:#173326;">${receivedAt} IST</td></tr>
            </table>
            <h2 style="margin:26px 0 10px;font-size:14px;color:#315b43;">Message</h2>
            <div style="padding:18px;background:#f5f8f5;border:1px solid #e3ebe5;border-radius:10px;font-size:14px;line-height:1.7;color:#263d30;overflow-wrap:anywhere;">${message}</div>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 16px;">
              <tr><td style="border-radius:8px;background:#15803d;">
                <a href="mailto:${email}?subject=${replySubject}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Reply to ${name}</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:18px 32px;background:#f8faf8;border-top:1px solid #e8eee9;font-size:12px;line-height:1.5;color:#78877e;">This notification was sent because a visitor submitted the CropGuard AI contact form.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function mailTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !process.env.CONTACT_EMAIL) return null;
  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a valid port number');
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

exports.create = async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!emailOk(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (typeof subject !== 'string' || !subject.trim()) return res.status(400).json({ error: 'Subject is required' });
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message is required' });
  if (name.length > 80 || email.length > 254 || subject.length > 120 || message.length > 5000) {
    return res.status(400).json({ error: 'Contact form fields exceed their maximum length' });
  }

  const saved = await ContactMessage.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    subject: subject.trim(),
    message: message.trim(),
  });

  let emailStatus = 'not_configured';
  try {
    const transport = mailTransport();
    if (transport) {
      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.CONTACT_EMAIL,
        replyTo: saved.email,
        subject: `CropGuard contact: ${saved.subject}`,
        text: `From: ${saved.name} <${saved.email}>\n\n${saved.message}`,
        html: contactEmailHtml(saved),
      });
      emailStatus = 'sent';
    }
  } catch (error) {
    console.error('Contact email notification failed:', error.message);
    emailStatus = 'failed';
  }

  res.status(201).json({
    message: 'Your message was saved.',
    emailSent: emailStatus === 'sent',
    emailStatus,
  });
};
