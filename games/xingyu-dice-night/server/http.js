import { buildRoot } from './build-root.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { attachRooms } from './rooms.js';

const root = fileURLToPath(buildRoot);
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp' };

export function gameServer() {
  const localHost = req => ['127.0.0.1','localhost'].some(host => req.headers.host === host + ':' + req.socket.localPort);
  const server = createServer(async (req, res) => {
    try {
      if (!localHost(req)) { res.writeHead(403).end(); return; }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'GET' ? bytes : undefined);
    } catch { res.writeHead(404).end(); }
  });
  const ws = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    if (!localHost(req) || req.url !== '/room' ||
      (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)) {
      socket.destroy(); return;
    }
    ws.handleUpgrade(req, socket, head, client => ws.emit('connection', client));
  });
  attachRooms(ws);
  return { server, listen: (port = 4321) => new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => { server.off('error', fail); ok(server.address().port); });
  }), close: async () => {
    for (const client of ws.clients) client.terminate();
    ws.close();
    await new Promise(resolveClose => server.close(resolveClose));
  } };
}
