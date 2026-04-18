import { fileURLToPath } from 'url';
import { validateEnv } from '../../src/index.js';

const dir = fileURLToPath(new URL('./strict/', import.meta.url));
validateEnv(dir, { strictExample: true });
console.log('Bu satir gorunuyorsa bir sorun var (strict senaryoda cikmamalidir).');
