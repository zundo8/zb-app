const fetch = require('node-fetch');

async function test() {
  const url = 'https://openai-whisper.hf.space/config';
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Keys in config:', Object.keys(data));
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
