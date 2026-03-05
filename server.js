// server.js — MK Store (zero npm dependencies)
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const store = require('./data/store');
const { handleAPI } = require('./routes/api');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html', '.css': 'text/css',
  '.js':   'application/javascript', '.json': 'application/json',
  '.png':  'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers':'Content-Type' });
    return res.end();
  }

  // API routes
  if (urlPath.startsWith('/api/')) {
    try { await handleAPI(req, res, urlPath); }
    catch (err) { console.error('API Error:', err); res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Internal server error'})); }
    return;
  }

  // /admin — respects adminVisible flag
  if (urlPath === '/admin' || urlPath === '/admin/') {
    const settings = store.shopSettings;
    const query    = req.url.includes('?') ? req.url.split('?')[1] : '';
    const params   = new URLSearchParams(query);
    const secret   = params.get('secret');

    // Re-enable via secret: /admin?secret=mkadmin2024
    if (!settings.adminVisible && secret === settings.adminSecret) {
      settings.adminVisible = true;
      console.log('🔓 Admin panel re-enabled via secret URL');
    }

    if (!settings.adminVisible) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;padding:2rem"><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>');
    }

    fs.readFile(path.join(__dirname, 'public', 'admin.html'), (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, {'Content-Type':'text/html'});
      res.end(data);
    });
    return;
  }

  // Static files
  const filePath = path.join(__dirname, 'public', urlPath === '/' ? 'index.html' : urlPath);
  const ext      = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, html) => {
        if (err2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, {'Content-Type':'text/html'});
        res.end(html);
      });
      return;
    }
    res.writeHead(200, {'Content-Type': MIME[ext] || 'text/plain'});
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   🎮  MK Store is LIVE!              ║`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ║   Admin: http://localhost:${PORT}/admin  ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
