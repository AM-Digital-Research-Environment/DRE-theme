#!/usr/bin/env node
/**
 * theme.ini contract lint — the config-layer companion to
 * check-design-tokens.mjs.
 *
 *   node scripts/check-theme-ini.mjs        (also: npm run lint:ini)
 *
 * Every check here encodes a bug that actually shipped in this theme:
 *
 *   1. Structural   — malformed lines, duplicate keys, unterminated strings.
 *   2. `.info`      — `elements.x.info` is silently ignored by Omeka; the key
 *                     it reads is `elements.x.options.info`. The
 *                     truncate_body_property help text was invisible for
 *                     ~20 releases because of this.
 *   3. Namespace    — `Zend\…` element types depend on a compatibility shim
 *                     Omeka S 4 no longer requires. Everything must be
 *                     `Laminas\…` or `Omeka\…`.
 *   4. Dead config  — an element declared here but never read via
 *                     themeSetting() renders an admin field that configures
 *                     nothing. Seven of these were inherited from the Lively
 *                     fork (footer_menu, footer_content, media_caption, …).
 *   5. Defaults     — `attributes.value` only pre-fills the admin form; it is
 *                     NOT themeSetting()'s fallback. When the two disagree,
 *                     every site that never saved theme settings gets the
 *                     template's hard-coded value. v2.24.0 moved
 *                     masthead_brand to "bold" in the INI while layout.phtml
 *                     still passed 'balanced' — the redesigned masthead
 *                     shipped and no visitor saw it.
 *   6. Helpers      — every `helpers[] = "X"` needs helper/X.php, and every
 *                     helper/X.php should be registered. ShadeColor.php sat
 *                     registered-but-uncalled, loaded on every request.
 *
 * Exit code 1 on any finding; prints the offending line where it has one.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const INI = join(ROOT, 'config', 'theme.ini');

const findings = [];
const add = (line, msg) => findings.push(line ? `config/theme.ini:${line}  ${msg}` : `  ${msg}`);

// Elements whose names are built dynamically at read time, so a literal
// themeSetting('name') grep will never see them.
const DYNAMIC_READS = [/^(facebook|twitter|linkedin|instagram|youtube|mastodon)_url$/];

// --- 1-3. Parse and check the file line by line --------------------------
const text = readFileSync(INI, 'utf8');
let section = null;
const seen = new Set();
const elements = new Map(); // name -> first line number
const elementDefaults = new Map(); // name -> { value, line } from attributes.value
const helpers = [];

text.split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith(';')) return;

    if (/^\[.+\]$/.test(s)) {
        section = s;
        return;
    }

    const m = s.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (!m) {
        add(lineNo, `malformed line: ${s}`);
        return;
    }
    const key = m[1].trim();
    const value = m[2].trim();

    if (!key.endsWith('[]')) {
        const full = `${section}|${key}`;
        if (seen.has(full)) add(lineNo, `duplicate key: ${key}`);
        seen.add(full);
    }

    if (value.startsWith('"') && !value.endsWith('"')) {
        add(lineNo, `unterminated string: ${key}`);
    }

    if (key === 'helpers[]') {
        helpers.push({ name: value.replace(/"/g, ''), line: lineNo });
    }

    // 2. `.info` where Omeka reads `.options.info`.
    if (/^elements\.[A-Za-z0-9_]+\.info$/.test(key)) {
        add(lineNo, `${key} is ignored by Omeka — use elements.<name>.options.info`);
    }

    // 3. Dead Zend namespace.
    if (/^elements\.[A-Za-z0-9_]+\.type$/.test(key) && /Zend\\/.test(value)) {
        add(lineNo, `Zend namespace in element type (${value}) — use Laminas\\…`);
    }

    // Declared admin default, for the fallback-agreement check below.
    const dm = key.match(/^elements\.([A-Za-z0-9_]+)\.attributes\.value$/);
    if (dm) elementDefaults.set(dm[1], { value: value.replace(/^"(.*)"$/, '$1'), line: lineNo });

    const em = key.match(/^elements\.([A-Za-z0-9_]+)\./);
    if (em && !elements.has(em[1])) elements.set(em[1], lineNo);
});

// --- 4. Declared-but-never-read elements ---------------------------------
//
// Scanned in Node rather than shelled out to grep. The previous
// `execSync('grep -rhoE …')` silently returned an empty string on any platform
// without grep — Windows/cmd.exe, i.e. `npm run build` — and an empty result
// means "no element is read anywhere", so the check reported EVERY field as
// dead. A lint that fails open on one OS and closed on another is worse than no
// lint; this walks the tree itself.
function* filesUnder(dir, exts) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) yield* filesUnder(p, exts);
        else if (exts.some((e) => name.endsWith(e))) yield p;
    }
}

// Allow whitespace inside the parens: themeSetting( 'x' ) is used too.
//
// The character class MUST match the one the element scan uses above
// ([A-Za-z0-9_]+). It was [a-z_]+, which cannot see a digit — so the first
// setting with a number in its name (banner_button2_link) was read normally by
// the template and still reported as a dead admin field. A name the declare
// side accepts and the read side cannot express is a false positive by
// construction.
const readNames = new Set();
const readSites = []; // { name, fallback|null, file }
for (const dir of ['view', 'helper']) {
    for (const file of filesUnder(join(ROOT, dir), ['.phtml', '.php'])) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/themeSetting\(\s*['"]([A-Za-z0-9_]+)['"]\s*(?:,\s*([^),]*?)\s*)?\)/g)) {
            readNames.add(m[1]);
            readSites.push({
                name: m[1],
                fallback: m[2] === undefined ? null : m[2].trim(),
                file: relative(ROOT, file).replace(/\\/g, '/'),
            });
        }
    }
}
for (const [name, line] of elements) {
    if (readNames.has(name)) continue;
    if (DYNAMIC_READS.some((re) => re.test(name))) continue;
    add(line, `element "${name}" is declared but never read via themeSetting() — dead admin field`);
}

// --- 5. theme.ini default <-> the PHP fallback at each call site ----------
//
// `elements.<n>.attributes.value` only PRE-FILLS the admin form on a fresh
// configure; it is NOT what themeSetting() falls back to. A site that has never
// saved theme settings has the key simply absent, so it is served whatever the
// template hard-codes as the second argument. When the two disagree, the
// declared default is a lie for exactly the installs that never touched the
// setting — i.e. the untouched majority.
//
// This shipped in v2.24.0: theme.ini moved masthead_brand to "bold" while
// layout.phtml still passed 'balanced', so the redesigned masthead was live and
// invisible on every existing site.
//
// Booleans are normalised because a checkbox is authored as 1/0 in INI and read
// as true/false in PHP — that pairing is correct, not a finding.
const BOOLISH = new Map([['1', 'true'], ['0', 'false'], ['true', 'true'], ['false', 'false']]);
const normalise = (v) => {
    const bare = String(v).trim().replace(/^['"](.*)['"]$/, '$1').toLowerCase();
    return BOOLISH.get(bare) ?? bare;
};

for (const site of readSites) {
    const declared = elementDefaults.get(site.name);
    if (!declared || site.fallback === null) continue; // nothing to compare
    if (normalise(declared.value) === normalise(site.fallback)) continue;
    add(
        declared.line,
        `element "${site.name}" declares attributes.value = ${declared.value} but ` +
            `${site.file} falls back to ${site.fallback} — a site that never saved ` +
            `theme settings gets the fallback, not the declared default`
    );
}

// --- 6. Helper registration <-> helper/*.php -----------------------------
const helperDir = join(ROOT, 'helper');
const onDisk = existsSync(helperDir)
    ? readdirSync(helperDir).filter((f) => f.endsWith('.php')).map((f) => f.replace(/\.php$/, ''))
    : [];

for (const { name, line } of helpers) {
    if (!onDisk.includes(name)) add(line, `helpers[] = "${name}" has no helper/${name}.php`);
}
for (const name of onDisk) {
    if (!helpers.some((h) => h.name === name)) {
        add(null, `helper/${name}.php exists but is not registered in [info] helpers[]`);
    }
}

// --- Report ---------------------------------------------------------------
if (findings.length) {
    console.error(`theme.ini contract: ${findings.length} finding(s)\n`);
    for (const f of findings) console.error('  ' + f);
    process.exit(1);
} else {
    console.log('theme.ini contract: clean.');
}
