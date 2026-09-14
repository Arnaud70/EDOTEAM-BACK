require('dotenv').config();

(async () => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.MAIL_FROM_NAME;
  const senderEmail = process.env.MAIL_FROM_EMAIL;
  const recipient = process.env.TEST_TO || senderEmail;

  if (!apiKey || !senderName || !senderEmail || !recipient) {
    console.error('BREVO_API_KEY, MAIL_FROM_NAME, MAIL_FROM_EMAIL and TEST_TO are required.');
    process.exit(1);
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: recipient }],
        subject: 'EDOTEAM Brevo API Test',
        htmlContent: `<p>Test envoyé via l'API HTTPS Brevo le ${new Date().toISOString()}.</p>`,
      }),
    });

    if (!response.ok) {
      console.error(`Brevo API test failed with HTTP ${response.status}.`);
      process.exit(2);
    }

    console.log('Email envoyé via Brevo');
  } catch (error) {
    console.error(`Brevo API test failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
})();
