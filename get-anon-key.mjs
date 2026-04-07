import https from 'https';

https.get('https://vendaprofit.com.br/', (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    const match = html.match(/\/assets\/index-[a-zA-Z0-9_-]+\.js/);
    if (match) {
      console.log('Found JS file:', match[0]);
      https.get('https://vendaprofit.com.br' + match[0], (jsRes) => {
        let js = '';
        jsRes.on('data', c => js += c);
        jsRes.on('end', () => {
          const keyMatch = js.match(/(sb_publishable_[a-zA-Z0-9_-]+)/);
          if (keyMatch) console.log('Anon Key:', keyMatch[1]);
          else console.log('Key not found in JS.');
        });
      });
    } else {
      console.log('JS file not found in HTML.');
    }
  });
});
