const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.in',
  port: 465,
  secure: true,
  auth: {
    user: 'admin@zicabella.com',
    pass: 'L6YHDRkF1zti',
  },
});

async function main() {
  try {
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('Connection verified successfully!');

    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: '"Zica Bella" <admin@zicabella.com>',
      to: 'admin@zicabella.com',
      subject: 'Test Email from Antigravity Scratch Script',
      text: 'This is a test email.',
      html: '<b>This is a test email.</b>',
    });
    console.log('Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

main();
