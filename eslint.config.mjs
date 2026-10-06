// ESLint flat config. `npm run lint:js` (part of lint:source, so of build and
// verify) runs it over every maintained script; it replaced the parse-only
// scripts/check-js.mjs in 2.33.1.
//
// Two worlds: the theme's own front-end scripts are classic browser scripts
// (one IIFE per file, loaded by Omeka's inlineScript/headScript, sharing only
// window.DREUtils), and everything else is Node ES modules.
import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'node_modules/',
            'test-results/',
            'artifacts/',
            'asset/css/',
            // Vendored, minified third-party build (Masonry 4.2.2, MIT).
            'asset/js/masonry.pkgd.min.js',
        ],
    },
    js.configs.recommended,
    {
        rules: {
            // `_`-prefixed names are deliberately unused (placeholders and
            // ignored catch bindings).
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
        },
    },
    {
        files: ['asset/js/**/*.js', 'tests/fixtures/**/*.js'],
        languageOptions: {
            // The browserslist floor (Safari/iOS 16.2) parses ES2022: newer
            // syntax here would be a parse error there.
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                // Provided by the lazily loaded asset/js/masonry.pkgd.min.js.
                Masonry: 'readonly',
            },
        },
    },
    {
        files: ['**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.node },
        },
    },
    {
        // Playwright specs and their helpers pass functions to page.evaluate(),
        // which run in the page, not in Node.
        files: ['tests/browser/**/*.mjs', 'tests/local/**/*.mjs', 'tests/visual-experiments/**/*.mjs', 'scripts/audit-*.mjs'],
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
        },
    },
];
