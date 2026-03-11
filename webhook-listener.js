const http = require('http');

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    console.log(`\n\x1b[36m[Webhook Received]\x1b[0m ${req.method} ${req.url}`);
    
    try {
      const parsedBody = JSON.parse(body);
      console.log(JSON.stringify(parsedBody, null, 2));
    } catch (e) {
      console.log('Raw body:', body);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  });
});

const PORT = 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\x1b[32m✅ Mock Corporate Webhook Application Server is currently listening on http://0.0.0.0:${PORT}\x1b[0m`);
  console.log(`Podman containers will reach this via http://host.containers.internal:${PORT}/webhook`);
  console.log(`Make changes in the Hoppscotch application to see the rich Audit JSON diffs appear here...`);
});
