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
 *   5. Helpers      — every `helpers[] = "X"` needs helper/X.php, and every
 *                     helper/X.php should be registered. ShadeColor.php sat
 *                     registered-but-uncalled, loaded on every request.
 *
 * Exit code 1 on any finding; prints the offending line where it has one.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

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

    const em = key.match(/^elements\.([A-Za-z0-9_]+)\./);
    if (em && !elements.has(em[1])) elements.set(em[1], lineNo);
});

// --- 4. Declared-but-never-read elements ---------------------------------
const grep = (cmd) => {
    try {
        return execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
    } catch {
        return ''; // grep exits 1 on no match
    }
};
// Allow whitespace inside the parens: themeSetting( 'x' ) is used too.
const readNames = new Set(
    grep(`grep -rhoE "themeSetting\\( *['\\"][a-z_]+" view helper`)
        .split('\n')
        .map((l) => l.replace(/.*themeSetting\(\s*['"]/, '').trim())
        .filter(Boolean)
);
for (const [name, line] of elements) {
    if (readNames.has(name)) continue;
    if (DYNAMIC_READS.some((re) => re.test(name))) continue;
    add(line, `element "${name}" is declared but never read via themeSetting() — dead admin field`);
}

// --- 5. Helper registration <-> helper/*.php -----------------------------
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
