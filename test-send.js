const nodemailer = require('nodemailer');

(async () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.error('Please set SMTP_HOST, SMTP_USER and SMTP_PASS environment variables before running this script.');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME || 'EDOTEAM'} <${process.env.MAIL_FROM_EMAIL || user}>`,
      to: process.env.TEST_TO || user,
      subject: 'EDOTEAM SMTP Test',
      text: `Test message sent at ${new Date().toISOString()}`,
    });
    console.log('Message sent:', info.messageId);
    console.log('Response:', info.response);
  } catch (err) {
    console.error('SMTP test failed:');
    console.error(err);
    process.exit(2);
  }
})();
