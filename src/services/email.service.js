const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
    },
});

// Verify the connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Error connecting to email server:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Backend Ledger" <${process.env.EMAIL_USER}>`, // sender address
            to, // list of receivers
            subject, // Subject line
            text, // plain text body
            html, // html body
        });

        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

// User ka naam HTML me jaane se pehle escape karo, warna koi name me <script> daal ke email kharab kar sakta hai
const escapeHtml = (str) =>
    String(str).replace(
        /[&<>"']/g,
        (c) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[c],
    );

// Register ke baad welcome email bhejta hai
async function sendRegistrationEmail(userEmail, name) {
    const safeName = escapeHtml(name);
    const subject = 'Welcome to Backend Ledger! 🎉';

    // Plain text version: jahan HTML show nahi hota wahan ye dikhega
    const text = `Hi ${name},
  
Welcome to Backend Ledger! Aapka account successfully ban gaya hai.

Ab aap login karke apne transactions manage kar sakte hain.

Agar aapne ye account nahi banaya, to is email ko ignore kar dein.

Regards,
Team Backend Ledger`;

    // Email clients me CSS limited chalti hai, isliye inline styles aur table layout
    const html = `
  <div style="background:#f4f6f8;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <table align="center" width="100%" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#2f6fed;padding:24px;text-align:center;color:#ffffff;">
          <h1 style="margin:0;font-size:22px;">Backend Ledger</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px;color:#333333;font-size:15px;line-height:1.6;">
          <h2 style="margin:0 0 12px;font-size:20px;">Welcome, ${safeName}! 🎉</h2>
          <p style="margin:0 0 12px;">Aapka account successfully ban gaya hai.</p>
          <p style="margin:0 0 12px;">Ab aap login karke apne transactions manage kar sakte hain.</p>
          <p style="margin:0;color:#777777;font-size:13px;">Agar aapne ye account nahi banaya, to is email ko ignore kar dein.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#f4f6f8;text-align:center;color:#999999;font-size:12px;">
          &copy; ${new Date().getFullYear()} Backend Ledger. All rights reserved.
        </td>
      </tr>
    </table>
  </div>`;

    await sendEmail(userEmail, subject, text, html);
}

module.exports = { sendEmail, sendRegistrationEmail };
