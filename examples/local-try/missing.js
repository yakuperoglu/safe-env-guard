import { fileURLToPath } from 'url';
import { validateEnv } from '../../src/index.js';

const dir = fileURLToPath(new URL('./missing/', import.meta.url));
validateEnv(dir);
console.log('Bu satir gorunuyorsa bir sorun var (missing senaryoda cikmamalidir).');
