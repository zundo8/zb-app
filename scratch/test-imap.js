const imaps = require('imap-simple');

const config = {
  imap: {
    user: 'admin@zicabella.com',
    password: 'L6YHDRkF1zti',
    host: 'imap.zoho.in',
    port: 993,
    tls: true,
    authTimeout: 10000,
  },
};

async function main() {
  try {
    console.log('Connecting to Zoho IMAP...');
    const connection = await imaps.connect(config);
    console.log('Connected! Opening INBOX...');
    await connection.openBox('INBOX');
    console.log('INBOX opened successfully!');
    
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER'],
      struct: true,
    };
    
    console.log('Searching messages...');
    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log('Total messages:', messages.length);
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log('Last message UID:', lastMsg.attributes.uid);
      console.log('Flags:', lastMsg.attributes.flags);
    }
    
    connection.end();
    console.log('Connection closed.');
  } catch (error) {
    console.error('IMAP Error:', error);
  }
}

main();
