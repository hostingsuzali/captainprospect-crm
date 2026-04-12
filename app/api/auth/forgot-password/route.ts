import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendTransactionalEmail } from "@/lib/email/transactional";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      // Always return success to prevent email enumeration
      return Response.json({ success: true });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, isActive: true },
    });

    // Always return success even if user doesn't exist (prevent enumeration)
    if (!user || user.isActive === false) {
      return Response.json({ success: true });
    }

    // Invalidate any existing unused tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email: normalizedEmail, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate a secure token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(rawToken, 10);

    // Store hashed token (expires in 1 hour)
    await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Build reset URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "https://app.captainprospect.fr";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send email
    await sendTransactionalEmail({
      to: normalizedEmail,
      subject: "Réinitialisation de votre mot de passe — Captain Prospect",
      html: buildResetEmailHtml(user.name, resetUrl),
      text: `Bonjour ${user.name},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe :\n${resetUrl}\n\nCe lien expire dans 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    // Still return success to prevent information leakage
    return Response.json({ success: true });
  }
}

function buildResetEmailHtml(name: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Réinitialisation du mot de passe</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 12px 12px 0 0; padding: 28px 36px; text-align: center;">
              <p style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                ⚓ Captain Prospect
              </p>
              <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8; letter-spacing: 0.04em; text-transform: uppercase;">
                Réinitialisation du mot de passe
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background-color: #ffffff; padding: 36px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">
                Bonjour ${name},
              </h1>
              <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">
                Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
              </p>

              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${resetUrl}"
                       style="display: inline-block; padding: 14px 36px; background: linear-gradient(160deg, #6366f1 0%, #1e1b4b 100%); color: #ffffff; font-size: 14px; font-weight: 700; border-radius: 10px; text-decoration: none; letter-spacing: 0.01em;">
                      Réinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef9c3; border-radius: 8px; border: 1px solid #fde68a;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0; font-size: 13px; color: #854d0e; line-height: 1.5;">
                      ⏰ Ce lien expire dans <strong>1 heure</strong>.<br/>
                      Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
                <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; padding: 20px 36px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8;">
                <strong style="color: #64748b;">Captain Prospect</strong> · Plateforme de prospection B2B
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                Cet email a été envoyé automatiquement. Ne pas répondre.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
