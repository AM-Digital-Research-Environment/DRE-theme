/**
 * Path of a theme script under test. The unit suites run twice (npm run
 * test:unit): against the sources, then with DRE_SCRIPTS=dist against the
 * minified files the templates load (scripts/build-js.mjs). The local browser
 * suite always runs the minified files (playwright.local.config.mjs), because
 * they are what ships.
 */
export const MINIFIED = process.env.DRE_SCRIPTS === 'dist';

/** 'browse' → 'asset/js/browse.js', or 'asset/js/dist/browse.min.js'. */
export const themeScript = (name) => (MINIFIED ? `asset/js/dist/${name}.min.js` : `asset/js/${name}.js`);
