#!/usr/bin/env node
/**
 * Template structure lint for view/**.phtml and helper/*.php.
 *
 *   node scripts/check-templates.mjs        (also: npm run lint:templates)
 *
 * This is NOT a PHP parser and does not replace `php -l`. It is a cheap
 * structural net for the mistakes that actually happen when editing Omeka
 * templates, and it runs anywhere Node does — useful because this theme is
 * developed on a machine with no PHP binary:
 *
 *   1. Unbalanced `<?php` / `?>` tags.
 *   2. Unbalanced braces / parens / brackets in PHP regions.
 *   3. `$this->partial('name')` referring to a view script that does not exist.
 *   4. Helper files: class name matches file name, correct namespace, and every
 *      helper/*.php is registered in theme.ini (and vice versa).
 *
 * Deliberately NOT checked: alternative-syntax balance (if/endif,
 * foreach/endforeach) and unknown-helper detection. Both were tried and both
 * produced false positives on known-good templates — the first miscounts
 * conditions containing comparison operators, the second would need an
 * exhaustive list of every Omeka, Laminas and module view helper. A lint that
 * cries wolf gets ignored, so they are out rather than approximate.
 *
 * Exit code 1 on any finding.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const VIEW = join(ROOT, 'view');
const HELPER = join(ROOT, 'helper');

/**
 * Partials this theme calls but deliberately does NOT override — Omeka resolves
 * them from core's own template stack. Keeping the list explicit (rather than
 * guessing by path prefix) means a typo in a theme-authored partial name is
 * still caught, and it documents exactly which core view scripts we depend on.
 */
const CORE_PARTIALS = new Set([
    'common/search-form',       // core site search form
    'common/advanced-search',   // core advanced-search form (we override its sub-partials)
]);

const findings = [];
const add = (file, line, msg) => findings.push(`${file}${line ? ':' + line : ''}  ${msg}`);

function* walk(dir) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) yield* walk(p);
        else if (/\.(phtml|php)$/.test(name)) yield p;
    }
}

/**
 * Split a file into PHP regions, with strings and comments blanked out so the
 * structural counters below never trip over a brace inside a string literal.
 */
function phpRegions(src) {
    const regions = [];
    let i = 0;
    while (i < src.length) {
        const open = src.indexOf('<?php', i) === i ? i : src.indexOf('<?php', i);
        if (open === -1) break;
        const isEcho = false;
        let j = open + 5;
        let out = '';
        let startLine = src.slice(0, open).split('\n').length;
        while (j < src.length) {
            const two = src.slice(j, j + 2);
            if (two === '?>') { j += 2; break; }
            const ch = src[j];
            // Line comments
            if (two === '//' || ch === '#') {
                const nl = src.indexOf('\n', j);
                const close = src.indexOf('?>', j);
                if (close !== -1 && (nl === -1 || close < nl)) { j = close; continue; }
                j = nl === -1 ? src.length : nl;
                out += ' ';
                continue;
            }
            // Block comments
            if (two === '/*') {
                const end = src.indexOf('*/', j + 2);
                j = end === -1 ? src.length : end + 2;
                out += ' ';
                continue;
            }
            // Strings
            if (ch === "'" || ch === '"') {
                const quote = ch;
                j++;
                while (j < src.length) {
                    if (src[j] === '\\') { j += 2; continue; }
                    if (src[j] === quote) { j++; break; }
                    j++;
                }
                out += '""';
                continue;
            }
            out += ch;
            j++;
        }
        regions.push({ code: out, startLine, isEcho });
        i = j;
    }
    return regions;
}

// Theme helpers registered in config/theme.ini.
const iniText = existsSync(join(ROOT, 'config', 'theme.ini'))
    ? readFileSync(join(ROOT, 'config', 'theme.ini'), 'utf8')
    : '';
const registeredHelpers = [...iniText.matchAll(/^helpers\[\]\s*=\s*"([^"]+)"/gm)].map((m) => m[1]);

for (const file of walk(VIEW)) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const src = readFileSync(file, 'utf8');

    // 1. Tag balance.
    const opens = (src.match(/<\?php|<\?=/g) || []).length;
    const closes = (src.match(/\?>/g) || []).length;
    if (closes > opens) add(rel, null, `more "?>" (${closes}) than "<?php" (${opens})`);

    const regions = phpRegions(src);
    const code = regions.map((r) => r.code).join('\n');

    // 2. Bracket balance across all PHP regions.
    for (const [openCh, closeCh, label] of [['{', '}', 'brace'], ['(', ')', 'paren'], ['[', ']', 'bracket']]) {
        const o = (code.match(new RegExp('\\' + openCh, 'g')) || []).length;
        const c = (code.match(new RegExp('\\' + closeCh, 'g')) || []).length;
        if (o !== c) add(rel, null, `unbalanced ${label}s: ${o} "${openCh}" vs ${c} "${closeCh}"`);
    }

    // 2b. A stray closing script tag inside a <script> body.
    //
    // The HTML parser does not understand JavaScript comments or strings. Per
    // the spec's "script data end tag name state" it ends the element at
    // `</script` when the next character is whitespace, "/" or ">" — so a JS
    // comment that merely spells the tag out terminates the block early,
    // dumping the rest of the script onto the page as visible text and leaving
    // its declarations undefined. That shipped in v2.21.0, in a comment
    // explaining this very hazard.
    //
    // This check is deliberately STRICTER than the spec: it flags any
    // `</script` in a script body, including spec-safe forms like `</script"`.
    // "Never write the sequence at all" is a rule you can remember; the
    // next-character subtlety is not, and minifiers and other parsers vary.
    //
    // PHP regions are excluded first — a `</script` inside a PHP comment is
    // never emitted (view/layout/layout.phtml has two, legitimately).
    {
        let html = '';
        let cursor = 0;
        while (cursor < src.length) {
            const open = src.indexOf('<?php', cursor);
            if (open === -1) { html += src.slice(cursor); break; }
            html += src.slice(cursor, open);
            const close = src.indexOf('?>', open);
            if (close === -1) break;
            cursor = close + 2;
        }
        const opens = (html.match(/<script\b/gi) || []).length;
        const closes = (html.match(/<\/script\b/gi) || []).length;
        if (closes > opens) {
            add(rel, null, `${closes} "</script" vs ${opens} "<script" — a stray closing tag (often inside a JS comment or string) ends the block early; write it as "<\\/script>"`);
        }
    }

    // 3b. Theme-helper call sites must match the theme.ini casing EXACTLY.
    //
    // Laminas ServiceManager v3 does not canonicalise service names, so a helper
    // registered as `CollectionStats` is NOT reachable as
    // `$this->collectionStats()`. Every working call site in this theme uses the
    // registered casing; this keeps it that way, because the failure mode is a
    // runtime "unable to resolve service" on a public page.
    for (const m of src.matchAll(/\$this->([A-Za-z][A-Za-z0-9_]*)\s*\(/g)) {
        const called = m[1];
        const registered = registeredHelpers.find(
            (h) => h.toLowerCase() === called.toLowerCase()
        );
        if (registered && registered !== called) {
            const line = src.slice(0, m.index).split('\n').length;
            add(rel, line, `$this->${called}() must match the theme.ini helper name exactly: $this->${registered}()`);
        }
    }

    // 3. partial() targets resolve.
    for (const m of src.matchAll(/partial\(\s*'([^']+)'/g)) {
        const name = m[1];
        if (name.includes('$')) continue;        // dynamic name
        if (CORE_PARTIALS.has(name)) continue;   // resolved from Omeka's stack
        const target = join(VIEW, ...name.split('/')) + '.phtml';
        if (existsSync(target)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        add(rel, line, `partial('${name}') → view/${name}.phtml does not exist (add to CORE_PARTIALS if Omeka supplies it)`);
    }
}

// 4. Helper sanity: class name matches file name, correct namespace, and the
// registration in theme.ini lines up in both directions.
const helperFiles = [];
for (const file of walk(HELPER)) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const base = rel.split('/').pop().replace(/\.php$/, '');
    helperFiles.push(base);
    const src = readFileSync(file, 'utf8');

    const cls = src.match(/^\s*class\s+([A-Za-z0-9_]+)/m);
    if (!cls) {
        add(rel, null, 'no class declaration found');
    } else if (cls[1] !== base) {
        add(rel, null, `class ${cls[1]} does not match file name ${base}.php`);
    }
    if (!/namespace\s+OmekaTheme\\Helper\s*;/.test(src)) {
        add(rel, null, 'missing `namespace OmekaTheme\\Helper;`');
    }
    if (!/function\s+__invoke\s*\(/.test(src)) {
        add(rel, null, 'no __invoke() — a view helper is not callable without one');
    }
}
for (const name of registeredHelpers) {
    if (!helperFiles.includes(name)) {
        add('config/theme.ini', null, `helpers[] = "${name}" has no helper/${name}.php`);
    }
}
for (const name of helperFiles) {
    if (!registeredHelpers.includes(name)) {
        add(`helper/${name}.php`, null, 'exists but is not registered in theme.ini [info] helpers[]');
    }
}

if (findings.length) {
    console.error(`Template structure: ${findings.length} finding(s)\n`);
    for (const f of findings) console.error('  ' + f);
    process.exit(1);
} else {
    console.log('Template structure: clean.');
}
