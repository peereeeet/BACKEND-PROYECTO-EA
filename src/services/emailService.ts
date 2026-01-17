import nodemailer from 'nodemailer';
import { logger } from '../config/logger';

const port = Number(process.env.SMTP_PORT || 465);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: port,
  secure: port === 465, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return info;
  } catch (error) {
    // Logging ONLY on error, without printing credentials
    logger.error(`Error sending email to ${to}: ${error}`);
    throw error; // Propagate error to controller
  }
};

export const sendVerificationEmail = async (to: string, code: string) => {
  const subject = 'Verifica tu correo electrónico';
  const html = `
    <h1>Bienvenido</h1>
    <p>Gracias por registrarte. Tu código de verificación es:</p>
    <h2>${code}</h2>
    <p>Este código expira en 15 minutos.</p>
  `;
  return sendEmail(to, subject, html);
};

export const sendPasswordResetEmail = async (to: string, code: string) => {
  const subject = 'Restablecimiento de contraseña';
  const html = `
    <h1>Recuperación de cuenta</h1>
    <p>Has solicitado restablecer tu contraseña. Tu código es:</p>
    <h2>${code}</h2>
    <p>Este código expira en 15 minutos. Si no solicitaste esto, ignora este correo.</p>
  `;
  return sendEmail(to, subject, html);
};
