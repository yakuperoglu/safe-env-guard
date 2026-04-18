import { fileURLToPath } from 'url';
import { validateEnv } from '../../src/index.js';

const dir = fileURLToPath(new URL('./ok/', import.meta.url));
validateEnv(dir);
console.log('Demo OK: validasyon gecti, uygulama acildi.');
