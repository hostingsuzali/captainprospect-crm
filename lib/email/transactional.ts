import * as nodemailer from "nodemailer";

export interface TransactionalEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

function getTransporter() {
  const host = process.env.SYSTEM_SMTP_HOST;
  const port = parseInt(process.env.SYSTEM_SMTP_PORT || "587", 10);
  const user = process.env.SYSTEM_SMTP_USER;
  const pass = process.env.SYSTEM_SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Send a system transactional email using SYSTEM_SMTP_* env vars.
 * Returns true on success, false if SMTP is not configured or sending fails.
 */
export async function sendTransactionalEmail(
  options: TransactionalEmailOptions
): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(
      "[transactional-email] SYSTEM_SMTP_* env vars not configured — skipping email send."
    );
    return false;
  }

  const from =
    process.env.SYSTEM_SMTP_FROM ||
    `Captain Prospect <${process.env.SYSTEM_SMTP_USER}>`;

  try {
    await transporter.sendMail({
      from,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error("[transactional-email] Failed to send email:", error);
    return false;
  }
}
