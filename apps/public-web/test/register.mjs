/**
 * Installs the test-only module-resolution hook used by `npm test`.
 * See `./ts-extension-hooks.mjs` for why it exists.
 */
import { register } from 'node:module';

register('./ts-extension-hooks.mjs', import.meta.url);
