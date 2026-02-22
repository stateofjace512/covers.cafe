import nodemailer from 'nodemailer';

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const smtpHost = import.meta.env.SMTP_HOST;
  const smtpPort = parseInt(import.meta.env.SMTP_PORT ?? '587', 10);
  const smtpUser = import.meta.env.SMTP_USER;
  const smtpPass = import.meta.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return { ok: false, error: 'Email service not configured' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"covers.cafe" <${smtpUser}>`,
      ...opts,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Renders the standard 6-digit code email used for any verification step. */
export function codeEmailHtml(code: string, purpose = 'verify your email address'): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px;">
      <h2 style="color:#c05a1a;margin-bottom:8px;">covers.cafe</h2>
      <p style="margin-bottom:24px;color:#555;">Enter this code to ${purpose}:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;
                  padding:16px;background:#f5f5f5;border-radius:8px;color:#111;margin-bottom:24px;">
        ${code}
      </div>
      <p style="color:#888;font-size:13px;">This code expires in 15 minutes. Do not share it with anyone.</p>
    </div>
  `;
}

/** Plain-text version of the code email. */
export function codeEmailText(code: string, purpose = 'verify your email address'): string {
  return `Your covers.cafe code to ${purpose} is: ${code}\n\nThis code expires in 15 minutes. Do not share it with anyone.`;
}
