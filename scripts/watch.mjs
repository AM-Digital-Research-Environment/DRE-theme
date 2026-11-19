#!/usr/bin/env node
/**
 * Rebuild the stylesheets and the minified scripts on every save.
 *
 *   npm run watch   (also: npm start)
 *
 * Both outputs are committed and both are what the templates load, so a
 * watcher that rebuilt only the CSS left a script edit invisible in the
 * browser until the next full build. One process, both watchers, Node
 * built-ins only.
 */
import { watchCss } from './build-css.mjs';
import { watchJs } from './build-js.mjs';

const closers = [];
try {
    closers.push(watchCss());
    closers.push(watchJs());
} catch (error) {
    closers.forEach((close) => close());
    console.error(error.message);
    process.exit(1);
}
const close = () => closers.forEach((stop) => stop());
process.once('SIGINT', close);
process.once('SIGTERM', close);
