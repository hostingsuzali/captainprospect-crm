import * as nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export interface TransactionalEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

const TRANSACTIONAL_EMAIL_FROM_CONFIG_KEY = "transactionalEmailFrom";

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

async function getConfiguredFromAddress(): Promise<string> {
  try {
    const record = await prisma.systemConfig.findUnique({
      where: { key: TRANSACTIONAL_EMAIL_FROM_CONFIG_KEY },
      select: { value: true },
    });
    const fromFromSettings = record?.value?.trim();
    if (fromFromSettings) {
      return fromFromSettings;
    }
  } catch (error) {
    console.error("[transactional-email] Failed to read sender from settings:", error);
  }

  return (
    process.env.SYSTEM_SMTP_FROM ||
    `Captain Prospect <${process.env.SYSTEM_SMTP_USER}>`
  );
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

  const from = await getConfiguredFromAddress();

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
