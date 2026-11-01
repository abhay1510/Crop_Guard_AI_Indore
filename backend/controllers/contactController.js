const nodemailer = require('nodemailer');
const ContactMessage = require('../models/ContactMessage');

const emailOk = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

  let emailSent = false;
  try {
    const transport = mailTransport();
    if (!transport) throw new Error('SMTP settings are incomplete');
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.CONTACT_EMAIL,
      replyTo: saved.email,
      subject: `CropGuard contact: ${saved.subject}`,
      text: `From: ${saved.name} <${saved.email}>\n\n${saved.message}`,
    });
    emailSent = true;
  } catch (error) {
    console.error('Contact email notification failed:', error.message);
  }

  res.status(201).json({
    message: 'Your message was saved.',
    emailSent,
  });
};
