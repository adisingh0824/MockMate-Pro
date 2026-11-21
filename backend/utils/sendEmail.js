const https = require('https');

const getResendApiKey = () =>
  (process.env.RESEND_API_KEY || '')
    .trim()
    .replace(/^['\"]|['\"]$/g, '');

const parseEmailFrom = (fromValue = '') => {
  const match = fromValue.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return {
      name: process.env.RESEND_SENDER_NAME || 'MockMate Pro',
      email: process.env.RESEND_SENDER_EMAIL || fromValue || '',
    };
  }

  return {
    name: (match[1] || '').trim() || process.env.RESEND_SENDER_NAME || 'MockMate Pro',
    email: (match[2] || '').trim() || process.env.RESEND_SENDER_EMAIL || '',
  };
};

const buildFromAddress = (sender) => {
  if (!sender?.email) return 'MockMate Pro <onboarding@resend.dev>';
  // Resend rejects unverified domains (like smartmeeter.online or personal gmail/yahoo)
  if (sender.email.includes('smartmeeter.online') || sender.email.includes('@gmail.com') || sender.email.includes('@yahoo.com')) {
    return 'MockMate Pro <onboarding@resend.dev>';
  }
  return sender.name ? `${sender.name} <${sender.email}>` : sender.email;
};

const sendWithResend = (payload) =>
  new Promise((resolve, reject) => {
    const apiKey = getResendApiKey();
    if (!apiKey) {
      return reject(new Error('No RESEND_API_KEY provided'));
    }

    const request = https.request(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
      (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
          if (!isSuccess) {
            return reject(
              new Error(`Resend request failed (${response.statusCode}): ${data || 'No response body'}`)
            );
          }

          resolve(data);
        });
      }
    );

    request.on('error', reject);
    request.write(JSON.stringify(payload));
    request.end();
  });

const sendOtpEmail = async (toEmail, toName, otp) => {
  const apiKey = getResendApiKey();

  // If RESEND_API_KEY is not configured, run in safe simulation mode
  if (!apiKey) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✉️  [MOCKMATE EMAIL DISPATCH] (Simulation Mode)`);
    console.log(`👤 Recipient: ${toName} <${toEmail}>`);
    console.log(`🔑 Verification OTP: [ ${otp} ]`);
    console.log(`⏰ Expiration: 10 minutes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return {
      success: true,
      simulated: true,
      otp,
      message: `OTP [ ${otp} ] generated (development mode)`,
    };
  }

  const rawSender = process.env.EMAIL_FROM || process.env.RESEND_FROM || process.env.RESEND_SENDER_EMAIL || '';
  const parsedSender = parseEmailFrom(rawSender);
  const fromAddress = buildFromAddress(parsedSender);

  const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;
                  border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; background: #ffffff;">

        <!-- Header -->
        <div style="background: #18181b; padding: 24px 32px;">
          <h2 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">MockMate Pro</h2>
          <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">
            AI-Powered Technical Assessment Platform
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <p style="font-size: 15px; color: #18181b; margin: 0 0 8px;">
            Hi <strong>${toName}</strong>,
          </p>
          <p style="font-size: 14px; color: #52525b; margin: 0 0 24px; line-height: 1.6;">
            Use the OTP code below to verify your email address and complete your registration.
            This code expires in <strong>10 minutes</strong>.
          </p>

          <!-- OTP Box -->
          <div style="background: #fafafa; border-radius: 8px; padding: 20px;
                      text-align: center; margin-bottom: 24px; border: 1px solid #e4e4e7;">
            <p style="margin: 0 0 8px; font-size: 12px; color: #71717a;
                      text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
              Your Verification Code
            </p>
            <p style="margin: 0; font-size: 36px; font-weight: 700;
                      letter-spacing: 8px; color: #18181b; font-family: monospace;">
              ${otp}
            </p>
          </div>

          <p style="font-size: 13px; color: #71717a; margin: 0; line-height: 1.6;">
            If you did not request this, please ignore this email.
            Your account will not be created without OTP verification.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #fafafa; padding: 16px 32px; border-top: 1px solid #e4e4e7;">
          <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
            © 2026 MockMate Pro. Created by Aditya Singh (sadityasingh7990@gmail.com).
          </p>
        </div>
      </div>
    `;

  const mailOptions = {
    from: fromAddress,
    to: [toEmail],
    subject: 'MockMate Pro — Your OTP Verification Code',
    html: htmlContent,
  };

  try {
    await sendWithResend(mailOptions);
    return { success: true, simulated: false, otp };
  } catch (err) {
    // If the sender domain is unverified (403), retry using Resend's default sandbox sender onboarding@resend.dev
    if (fromAddress !== 'MockMate Pro <onboarding@resend.dev>') {
      try {
        console.log('Retrying email dispatch using Resend test sender (onboarding@resend.dev)...');
        await sendWithResend({
          ...mailOptions,
          from: 'MockMate Pro <onboarding@resend.dev>',
        });
        return { success: true, simulated: false, otp };
      } catch (retryErr) {
        console.warn(`Retry with onboarding@resend.dev failed: ${retryErr.message}`);
      }
    }

    // Graceful fallback: return the OTP code directly so user is NEVER blocked by an email delivery issue
    console.warn(`⚠️ Resend delivery issue (${err.message}). Returning OTP in response.`);
    console.log(`🔑 Verification code for ${toEmail}: [ ${otp} ]`);
    return {
      success: true,
      simulated: true,
      otp,
      deliveryError: err.message,
    };
  }
};

module.exports = { sendOtpEmail };
