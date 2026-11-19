import { existsSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';

const folder = new URL('./public/art/', import.meta.url);
const slots = existsSync(folder)
  ? readdirSync(folder).filter(name => /^[a-z0-9-]+\.webp$/.test(name)).map(name => name.slice(0, -5))
  : [];
export default defineConfig({ define: { __ART_SLOTS__: JSON.stringify(slots) } });
