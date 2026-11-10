/**
 * config/amira-pages.php, read from Node: the AMIRA page slugs and their menu
 * copy, for the production smoke inventory and anything else in JavaScript
 * that names an AMIRA page.
 *
 * The PHP file is the one source (the templates include it, and its copy is
 * extracted for translation); this reads it as text rather than running PHP,
 * because the live smoke workflow needs no PHP. That works because the file
 * keeps one `'key' => 'value',` pair per line inside each named list; the
 * unit test (tests/js/amira-pages.test.mjs) compares this reading with PHP's
 * own when a PHP is available.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(import.meta.dirname, '..', '..', 'config', 'amira-pages.php');

/** Unquote a PHP single- or double-quoted literal (the escapes the file uses). */
function unquote(raw) {
    const quote = raw[0];
    const body = raw.slice(1, -1);
    return quote === "'"
        ? body.replace(/\\(['\\])/g, '$1')
        : body.replace(/\\(["\\$])/g, '$1');
}

const LITERAL = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")`;
const LIST_OPEN = new RegExp(String.raw`^\s*'(\w+)'\s*=>\s*\[\s*$`);
const PAIR = new RegExp(String.raw`^\s*${LITERAL}\s*=>\s*${LITERAL}\s*,`);

/**
 * @param {string} [source] the PHP file's text (defaults to config/amira-pages.php)
 * @returns {Record<string, Record<string, string>>} each named list, key → value
 */
export function parseAmiraPages(source = readFileSync(FILE, 'utf8')) {
    const lists = {};
    let current = null;
    for (const line of source.split(/\r?\n/)) {
        const open = line.match(LIST_OPEN);
        if (open) {
            current = lists[open[1]] = {};
            continue;
        }
        if (/^\s*\],?\s*$/.test(line)) {
            current = null;
            continue;
        }
        const pair = current && line.match(PAIR);
        if (pair) current[unquote(pair[1])] = unquote(pair[2]);
    }
    for (const name of ['intros', 'descriptions', 'statPages']) {
        if (!lists[name] || !Object.keys(lists[name]).length) {
            throw new Error(`config/amira-pages.php: no '${name}' list could be read`);
        }
    }
    return lists;
}

let cached;
const pages = () => (cached ??= parseAmiraPages());

/** Every page slug the theme names: section intros, child descriptions, count links. */
export function amiraSlugs() {
    const { intros, descriptions, statPages } = pages();
    return new Set([...Object.keys(intros), ...Object.keys(descriptions), ...Object.values(statPages)]);
}

/** The slug of the page a home-banner count links to (`researchItems` → `research-items`). */
export function statPage(metric) {
    const slug = pages().statPages[metric];
    if (!slug) throw new Error(`config/amira-pages.php names no page for the metric ${metric}`);
    return slug;
}

/** `/s/<site>/page/<slug>` for a slug the data file knows; throws for one it does not. */
export function amiraPagePath(slug, site = 'amira') {
    if (!amiraSlugs().has(slug)) throw new Error(`config/amira-pages.php has no page ${slug}`);
    return `/s/${site}/page/${slug}`;
}
