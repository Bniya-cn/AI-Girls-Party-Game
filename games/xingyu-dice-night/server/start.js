import { buildRoot } from './build-root.js';
import { access } from 'node:fs/promises';
import { gameServer } from './http.js';
try {
  await access(new URL('index.html', buildRoot));
} catch {
  console.error('请先运行 npm run build');
  process.exit(1);
}
const service = gameServer();
const port = await service.listen(Number(process.env.PORT || 4321));
console.log('星屿骰夜  http://127.0.0.1:' + port);
