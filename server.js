const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3005;
const root = __dirname;

const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  let filePath = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (!path.extname(filePath)) filePath = path.join(filePath, '') || filePath;

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(filePath)) {
        filePath = path.join(root, 'index.html');
      } else {
        res.writeHead(404); res.end('Not found'); return;
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range && (ext === '.mp4')) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': types[ext] || 'application/octet-stream',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': types[ext] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Content-Length': stat.size,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}).listen(port, () => console.log(`serving on http://localhost:${port}`));
