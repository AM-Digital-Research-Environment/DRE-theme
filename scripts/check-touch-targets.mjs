#!/usr/bin/env node
/**
 * Source contracts for the high-frequency mobile header controls.
 *
 * The controls keep compact 18–35px glyphs, but their interactive boxes must
 * use the shared 44px token. This check protects that distinction without
 * relying on a deployed Omeka instance.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const failures = [];

function read(relativePath) {
    return readFileSync(join(ROOT, relativePath), 'utf8');
}

function requirePattern(source, pattern, message) {
    if (!pattern.test(source)) failures.push(message);
}

const header = read('asset/sass/components/header/_header.scss');
const search = read('asset/sass/components/header/_search.scss');
const navigation = read('asset/sass/components/navigation/_navigation.scss');
const pwa = read('asset/sass/components/pwa/_pwa-install.scss');
const tokens = read('asset/sass/abstracts/variables/_tokens.scss');

requirePattern(
    tokens,
    /--size-control-lg:\s*2\.75rem;/,
    'the shared large-control token must remain 44px',
);
requirePattern(
    header,
    /\.theme-toggle\s*\{[\s\S]{0,260}?width:\s*var\(--size-control-lg\);[\s\S]{0,80}?height:\s*var\(--size-control-lg\);/,
    'the theme toggle must use the 44px control token',
);
requirePattern(
    search,
    /\.main-search-button\s*\{[\s\S]{0,220}?width:\s*var\(--size-control-lg\);[\s\S]{0,80}?height:\s*var\(--size-control-lg\);/,
    'the fallback mobile search button must use the 44px control token',
);
requirePattern(
    search,
    /calc\(var\(--space-2\) \+ var\(--size-control-lg, 2\.75rem\) \+ var\(--space-2\)\)/,
    'the expanded mobile search panel must clear the 44px field',
);
requirePattern(
    navigation,
    /&__toggle\s*\{[\s\S]{0,180}?width:\s*var\(--size-control-lg\);[\s\S]{0,80}?height:\s*var\(--size-control-lg\);[\s\S]{0,80}?min-width:\s*var\(--size-control-lg\);[\s\S]{0,80}?min-height:\s*var\(--size-control-lg\);/,
    'the menu toggle must expose a non-shrinking 44px box',
);
requirePattern(
    navigation,
    /span\s*\{[\s\S]{0,180}?width:\s*35px;/,
    'the larger menu target must preserve its compact 35px glyph',
);
requirePattern(
    pwa,
    /\.pwa-install\s*\{[\s\S]{0,360}?width:\s*var\(--size-control-lg\);[\s\S]{0,80}?height:\s*var\(--size-control-lg\);/,
    'the install control must use the 44px control token',
);

if (failures.length) {
    console.error(`Touch-target contracts: ${failures.length} finding(s)`);
    for (const message of failures) console.error(`  ${message}`);
    process.exit(1);
}

console.log('Touch-target contracts: clean (44px boxes, compact glyphs).');
