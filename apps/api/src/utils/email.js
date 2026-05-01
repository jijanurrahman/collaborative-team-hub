const nodemailer = require('nodemailer');
const { logger } = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_USER) {
    logger.warn('Email not configured, skipping send');
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Team Hub <noreply@teamhub.app>',
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    logger.error('Email send failed:', err);
  }
}

async function sendInvitationEmail({ to, inviterName, workspaceName, inviteLink }) {
  return sendEmail({
    to,
    subject: `${inviterName} invited you to join ${workspaceName} on Team Hub`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">You're invited to Team Hub!</h2>
        <p><strong>${inviterName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace.</p>
        <a href="${inviteLink}" style="
          display: inline-block;
          background: #6366f1;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin: 16px 0;
        ">Accept Invitation</a>
        <p style="color: #666; font-size: 12px;">This link expires in 7 days.</p>
      </div>
    `,
  });
}

async function sendMentionEmail({ to, mentionerName, workspaceName, context, link }) {
  return sendEmail({
    to,
    subject: `${mentionerName} mentioned you in ${workspaceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">You were mentioned!</h2>
        <p><strong>${mentionerName}</strong> mentioned you in <strong>${workspaceName}</strong>.</p>
        <blockquote style="border-left: 3px solid #6366f1; padding-left: 16px; color: #444;">${context}</blockquote>
        <a href="${link}" style="
          display: inline-block;
          background: #6366f1;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
        ">View Comment</a>
      </div>
    `,
  });
}

module.exports = { sendEmail, sendInvitationEmail, sendMentionEmail };
