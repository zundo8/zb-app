import { sendMail } from './lib/mailer.js';

async function test() {
  try {
    await sendMail({
      to: 'karthik@example.com',
      subject: 'Test mail',
      html: '<p>Testing</p>'
    });
    console.log('Mail sent successfully');
  } catch (error) {
    console.error('Failed to send mail:', error);
  }
}

test();
