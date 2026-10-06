#!/usr/bin/env node
/**
 * Gettext extractor → language/template.pot
 *
 *   node scripts/extract-translations.mjs      (also: npm run i18n:extract)
 *
 * The theme shipped no language/ directory at all, so every $this->translate()
 * call in it could only resolve strings that happened to already exist in
 * Omeka core's catalogue — theme-authored copy ("Explore the collection", the
 * search empty-state hints, the nav panel descriptions) was untranslatable in
 * practice. This produces the POT that translators work from.
 *
 * A Node script rather than xgettext because the theme is developed on a
 * machine without the gettext tools (or PHP) installed.
 *
 * Extracted forms:
 *   $this->translate('X')      $translate('X')      $view->translate('X')
 *   $this->translatePlural('one', 'many', $n)
 *   'X', // @translate         "X" // @translate
 *
 * Pass --check to fail (exit 1) when template.pot is out of date instead of
 * rewriting it — useful in CI.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { walkFiles } from './files.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'language');
const OUT = join(OUT_DIR, 'template.pot');
const CHECK = process.argv.includes('--check');

const SCAN = ['view', 'helper'];

const PLURAL_SEPARATOR = '\u0000';

/** Plural msgids use PLURAL_SEPARATOR between singular and plural forms. */
const entries = new Map();

function record(key, ref) {
    if (!entries.has(key)) entries.set(key, new Set());
    entries.get(key).add(ref);
}

const walk = (dir) => walkFiles(dir, /\.(?:phtml|php)$/);

/** Unescape a PHP single- or double-quoted literal into its runtime value. */
function phpString(raw, quote) {
    if (quote === "'") {
        return raw.replace(/\\\\/g, '\\').replace(/\\'/g, "'");
    }
    return raw
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}

/** Escape a runtime string for a .po msgid. */
function poEscape(s) {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
}

const STR = `(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`;
const RE_TRANSLATE = new RegExp(`(?:->|\\$)translate\\s*\\(\\s*${STR}`, 'g');
const RE_PLURAL = new RegExp(`(?:->|\\$)translatePlural\\s*\\(\\s*${STR}\\s*,\\s*${STR}`, 'g');
const RE_MARKER = new RegExp(`${STR}\\s*,?\\s*//\\s*@translate`, 'g');

const lineOf = (src, index) => src.slice(0, index).split('\n').length;
const pick = (m, a, b) => (m[a] !== undefined ? phpString(m[a], "'") : phpString(m[b], '"'));

for (const dir of SCAN) {
    for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split(sep).join('/');
        const src = readFileSync(file, 'utf8');

        for (const m of src.matchAll(RE_PLURAL)) {
            const single = pick(m, 1, 2);
            const plural = pick(m, 3, 4);
            if (single) record(`${single}${PLURAL_SEPARATOR}${plural}`, `${rel}:${lineOf(src, m.index)}`);
        }
        for (const m of src.matchAll(RE_TRANSLATE)) {
            const s = pick(m, 1, 2);
            if (s) record(s, `${rel}:${lineOf(src, m.index)}`);
        }
        for (const m of src.matchAll(RE_MARKER)) {
            const s = pick(m, 1, 2);
            if (s) record(s, `${rel}:${lineOf(src, m.index)}`);
        }
    }
}

// Deterministic order so the POT does not churn between runs.
const sorted = [...entries.keys()].sort((a, b) => a.localeCompare(b, 'en'));

const header = `# Africa Multiple — DRE (Omeka S theme)
# Translation template. Regenerate with: npm run i18n:extract
#
# To add a language, copy this file to <locale>.po (e.g. de.po), fill in the
# msgstr values, compile it to <locale>.mo, and place both in language/.
#
msgid ""
msgstr ""
"Project-Id-Version: DRE theme\\n"
"Report-Msgid-Bugs-To: https://github.com/AM-Digital-Research-Environment/DRE-theme/issues\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
`;

let body = '';
for (const key of sorted) {
    const refs = [...entries.get(key)].sort();
    body += '\n';
    for (const ref of refs) body += `#: ${ref}\n`;
    if (key.includes(PLURAL_SEPARATOR)) {
        const [single, plural] = key.split(PLURAL_SEPARATOR);
        body += `msgid "${poEscape(single)}"\n`;
        body += `msgid_plural "${poEscape(plural)}"\n`;
        body += 'msgstr[0] ""\nmsgstr[1] ""\n';
    } else {
        body += `msgid "${poEscape(key)}"\n`;
        body += 'msgstr ""\n';
    }
}

const pot = header + body;

if (CHECK) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    // Git may materialize tracked text as CRLF on Windows. Compare canonical
    // LF content so `--check` reports translation drift, not checkout policy.
    if (current.replace(/\r\n/g, '\n') !== pot) {
        console.error('language/template.pot is out of date — run: npm run i18n:extract');
        process.exit(1);
    }
    console.log(`Translations: template.pot up to date (${sorted.length} strings).`);
} else {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, pot, 'utf8');
    console.log(`Translations: wrote language/template.pot (${sorted.length} strings).`);
}
