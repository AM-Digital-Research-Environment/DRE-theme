/**
 * The translation catalogues in language/*.po, checked for what breaks a page.
 *
 * Omeka passes a translated string to sprintf() wherever the msgid has
 * placeholders (`sprintf($translate('%s items'), $count)`). Under PHP 8 a
 * translation with a placeholder the msgid does not have throws an
 * ArgumentCountError (or a ValueError for an unknown conversion): the page
 * fails, in that language only. One that drops a placeholder silently loses
 * the value. So a translation must use the same placeholders as its msgid,
 * in any order: `%s … %d` may become `%2$d … %1$s`.
 *
 * Used by `npm run i18n:check` (scripts/extract-translations.mjs --check).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Unescape the body of one .po string literal. */
function unquote(literal) {
    return literal.slice(1, -1).replace(/\\(.)/g, (_, ch) => ({ n: '\n', t: '\t', r: '\r' })[ch] ?? ch);
}

/**
 * Entries of a .po file: `{ msgid, msgidPlural, msgstr: [..], fuzzy, line }`.
 * Continuation lines ("…") are joined; obsolete (`#~`) entries are skipped.
 */
export function parsePo(text) {
    const entries = [];
    let entry = null;
    let field = null;
    let flags = '';
    const flush = () => {
        if (entry) entries.push(entry);
        entry = null;
        field = null;
    };
    text.replace(/\r\n/g, '\n').split('\n').forEach((raw, i) => {
        const line = raw.trim();
        if (!line) { flush(); flags = ''; return; }
        if (line.startsWith('#~')) return;
        if (line.startsWith('#,')) { flags += line; return; }
        if (line.startsWith('#')) return;
        const m = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s+("(?:[^"\\]|\\.)*")$/.exec(line);
        if (m) {
            if ((m[1] === 'msgid' || m[1] === 'msgctxt') && entry?.msgid !== undefined) flush();
            entry ??= { msgstr: [], line: i + 1, fuzzy: /\bfuzzy\b/.test(flags) };
            const value = unquote(m[3]);
            if (m[1] === 'msgctxt') field = ['msgctxt'];
            else if (m[1] === 'msgid') field = ['msgid'];
            else if (m[1] === 'msgid_plural') field = ['msgidPlural'];
            else field = ['msgstr', Number(m[2] ?? 0)];
            if (field[0] === 'msgstr') entry.msgstr[field[1]] = value;
            else entry[field[0]] = value;
            return;
        }
        if (/^"(?:[^"\\]|\\.)*"$/.test(line) && entry && field) {
            if (field[0] === 'msgstr') entry.msgstr[field[1]] += unquote(line);
            else entry[field[0]] += unquote(line);
        }
    });
    flush();
    return entries;
}

/**
 * The printf placeholders of a string, as a sorted set of `<argument>$<type>`:
 * `%s and %d` → ['1$s', '2$d'], and so does `%2$d and %1$s`. `%%` is a literal
 * percent sign. The space flag is not recognised, so prose such as "50% de"
 * reads as text rather than as a `% d` conversion.
 */
export function placeholders(text) {
    const found = new Set();
    let next = 1;
    for (const m of text.matchAll(/%%|%(?:(\d+)\$)?[-+0]*(?:'.)?\d*(?:\.\d+)?([bcdeEfFgGhHosuxX])/g)) {
        if (m[0] === '%%') continue;
        const argument = m[1] ? Number(m[1]) : next++;
        found.add(`${argument}$${m[2]}`);
    }
    return [...found].sort();
}

const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);

/** Placeholder mismatches in one .po text, as messages naming `file:line`. */
export function placeholderMismatches(text, file = 'language/xx.po') {
    const problems = [];
    for (const entry of parsePo(text)) {
        if (!entry.msgid || entry.fuzzy) continue;
        const singular = placeholders(entry.msgid);
        const plural = entry.msgidPlural === undefined ? null : placeholders(entry.msgidPlural);
        const show = (list) => (list.length ? list.join(', ') : 'none');
        entry.msgstr.forEach((translation, index) => {
            if (!translation) return; // untranslated: gettext falls back to the msgid
            const used = placeholders(translation);
            if (plural === null) {
                if (!same(used, singular)) {
                    problems.push(`${file}:${entry.line}  msgstr uses ${show(used)} but msgid "${entry.msgid}" has ${show(singular)}`);
                }
                return;
            }
            // A plural form may leave the count out ("one item"), but may not
            // ask for an argument neither source form supplies.
            const allowed = new Set([...singular, ...plural]);
            const extra = used.filter((p) => !allowed.has(p));
            if (extra.length) {
                problems.push(`${file}:${entry.line}  msgstr[${index}] uses ${extra.join(', ')}, which msgid "${entry.msgid}" / msgid_plural do not have`);
            }
        });
    }
    return problems;
}

/** Mismatches across every language/*.po under `languageDir`. */
export function checkCatalogues(languageDir) {
    let names;
    try {
        names = readdirSync(languageDir).filter((name) => name.endsWith('.po')).sort();
    } catch (error) {
        if (error.code === 'ENOENT') return { files: 0, problems: [] };
        throw error;
    }
    const problems = names.flatMap((name) =>
        placeholderMismatches(readFileSync(join(languageDir, name), 'utf8'), `language/${name}`));
    return { files: names.length, problems };
}
