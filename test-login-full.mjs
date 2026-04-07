import https from 'https';

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function doLogin(anonKey) {
  const data = JSON.stringify({ email: "teamwodbrasil@gmail.com", password: "VendaProfit123" });
  
  const req = https.request({
    hostname: 'nkmktefsbvhjexodkbtw.supabase.co',
    path: '/auth/v1/token?grant_type=password',
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Body:', body);
    });
  });
  
  req.write(data);
  req.end();
}

async function run() {
  console.log("Fetching HTML...");
  const html = await fetchUrl('https://vendaprofit.com.br/');
  const match = html.match(/\/assets\/index-[a-zA-Z0-9_-]+\.js/);
  if (!match) return console.log("JS not found in HTML");
  
  console.log("Fetching JS:", match[0]);
  const js = await fetchUrl('https://vendaprofit.com.br' + match[0]);
  const keyMatch = js.match(/(sb_publishable_[a-zA-Z0-9_-]+)/);
  if (!keyMatch) return console.log("Key not found");
  
  const anonKey = keyMatch[1];
  console.log("Extracted Anon Key:", anonKey.substring(0, 15) + "...");
  console.log("Attempting login...");
  await doLogin(anonKey);
}

run();
