#!/usr/bin/env node
/**
 * Assert that every name in the theme–module contract still exists on both
 * sides: the helpers, the service, the routes, profiles and facets, the
 * search bar's custom properties, the page events, the globals and the shared
 * identity table (scripts/lib/integration-contract.mjs, explained in
 * docs/INTEGRATION-CONTRACT.md).
 *
 *   node scripts/check-integration-contract.mjs         (npm run check:contract)
 *
 *   --root=<dir>        the theme checkout (default: this one); the modules
 *                       are looked up beside it (scripts/lib/siblings.mjs)
 *   --contract=<file>   another contract module (the unit tests' fixture)
 *   --theme-only        run only the theme's half and the document check, as
 *                       if no module were checked out, and pass under CI too:
 *                       what `npm run verify` runs, so a contributor's stale
 *                       module checkout cannot fail a theme commit
 *
 * The theme-side checks always run, and so does the check that the document
 * names every entry. A module that is not checked out is reported as MISSING
 * and its checks are skipped: locally that passes with a warning, since a
 * contributor may not have every module; under CI=true it fails, because the
 * jobs that run this check the modules out, and a check that cannot see a
 * module cannot vouch for it.
 *
 * WHY. Only the design tokens were checked across repositories. A renamed
 * helper or service degrades silently (every consumer guards with has()), so a
 * rename was invisible until someone noticed a missing citation or a masthead
 * that had fallen back to its slower counts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sibling } from './lib/siblings.mjs';

const args = Object.fromEntries(process.argv.slice(2)
  .filter((a) => a.startsWith('--') && a.includes('='))
  .map((a) => { const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)]; }));
const ROOT = resolve(args.root ?? join(import.meta.dirname, '..'));
const contractPath = resolve(args.contract ?? join(import.meta.dirname, 'lib', 'integration-contract.mjs'));
const { CONTRACT, DOCUMENT } = await import(pathToFileURL(contractPath).href);
const THEME_ONLY = process.argv.includes('--theme-only');
const CI = !THEME_ONLY && (process.env.CI === 'true' || process.env.CI === '1');

// --- Reading the repositories ------------------------------------------------

const repos = new Map();
function repo(key) {
  if (!repos.has(key)) {
    const found = key === 'theme' ? { path: ROOT, found: true } : sibling(key, ROOT);
    repos.set(key, THEME_ONLY && key !== 'theme' ? { ...found, found: false } : found);
  }
  return repos.get(key);
}

const cache = new Map();
/** The file's text, or null when it does not exist. */
function read(key, file) {
  const path = join(repo(key).path, file);
  if (!cache.has(path)) cache.set(path, existsSync(path) ? readFileSync(path, 'utf8') : null);
  return cache.get(path);
}

/** PHP or JavaScript source without block comments and whole-line comments. */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(?:\/\/|#).*$/gm, '');
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = (t) => (typeof t === 'string' ? new RegExp(escape(t)) : new RegExp(t.re));
const show = (t) => (typeof t === 'string' ? t : `/${t.re}/`);
const where = (key, file) => `${key === 'theme' ? '' : `${key}:`}${file}`;

/** The repositories a check reads. */
function reposOf(check) {
  const keys = new Set();
  if (check.repo) keys.add(check.repo);
  if (check.theme || check.type === 'reads') keys.add('theme');
  for (const f of check.files ?? []) if (typeof f === 'object') keys.add(f.repo);
  if (check.provider) keys.add(check.provider.repo);
  for (const c of check.consumers ?? []) keys.add(c.repo);
  return [...keys];
}

// --- Checks: each returns a list of problems ----------------------------------

/** Text, or a problem when the file is missing. */
function need(key, file, problems) {
  const text = read(key, file);
  if (text === null) problems.push(`${where(key, file)} does not exist`);
  return text;
}

/** The PHP array keys of a list: `'name' => [` or `const NAME = [` up to its `]`. */
function listKeys(text, list) {
  const open = new RegExp(String.raw`(?:'${escape(list)}'\s*=>|const\s+${escape(list)}\s*=)\s*\[`).exec(text);
  if (!open) return null;
  let depth = 1;
  let i = open.index + open[0].length;
  const start = i;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') depth--;
  }
  const body = code(text.slice(start, i - 1));
  return [...body.matchAll(/^\s*'([^']+)'\s*=>/gm)].map((m) => m[1]);
}

/** The members a file defines or uses, by `pattern` (group 1), inside `block`. */
function members(text, { block, pattern: source }) {
  let scope = code(text);
  if (block) {
    const m = new RegExp(block).exec(scope);
    if (!m) return null;
    scope = m[1];
  }
  return new Set([...scope.matchAll(new RegExp(source, 'gm'))].map((m) => m[1]));
}

const CHECKS = {
  includes(c, problems) {
    const text = need(c.repo, c.file, problems);
    if (text === null) return;
    for (const t of c.text) {
      if (!pattern(t).test(text)) problems.push(`${where(c.repo, c.file)} no longer contains ${show(t)}`);
    }
  },

  helper(c, problems) {
    const text = need(c.repo, c.file, problems);
    if (text === null) return;
    const block = /'view_helpers'\s*=>\s*\[([\s\S]*?)\n {4}\],?\n/.exec(code(text));
    if (!block) {
      problems.push(`${where(c.repo, c.file)} has no view_helpers block`);
    } else if (!new RegExp(String.raw`'${escape(c.name)}'\s*=>`).test(block[1])) {
      problems.push(`${where(c.repo, c.file)} no longer registers the view helper '${c.name}'`);
    }
  },

  keys(c, problems) {
    const texts = c.files.map((f) => need(c.repo, f, problems));
    if (texts.includes(null)) return;
    const source = texts.map(code).join('\n');
    for (const key of c.keys) {
      if (!new RegExp(String.raw`['"]${escape(key)}['"]\s*=>`).test(source)) {
        problems.push(`${c.files.map((f) => where(c.repo, f)).join(', ')} no longer return${c.files.length > 1 ? '' : 's'} the key '${key}'`);
      }
    }
  },

  reads(c, problems) {
    const texts = c.files.map((f) => need('theme', f, problems));
    if (texts.includes(null)) return;
    const source = texts.join('\n');
    for (const key of c.keys) {
      if (!new RegExp(String.raw`\[['"]${escape(key)}['"]\]`).test(source)) {
        problems.push(`${c.files.join(', ')} no longer read${c.files.length > 1 ? '' : 's'} ['${key}']: drop it from the contract or restore the read`);
      }
    }
  },

  members(c, problems) {
    const text = need(c.provider.repo, c.provider.file, problems);
    if (text === null) return;
    const provided = members(text, c.provider);
    if (!provided?.size) {
      problems.push(`${where(c.provider.repo, c.provider.file)} defines no members by /${c.provider.pattern}/`);
      return;
    }
    for (const consumer of c.consumers) {
      if (!repo(consumer.repo).found) continue;
      const used = need(consumer.repo, consumer.file, problems);
      if (used === null) continue;
      const names = members(used, consumer);
      if (!names?.size) {
        problems.push(`${where(consumer.repo, consumer.file)} uses no members by /${consumer.pattern}/ (the check no longer sees its consumer)`);
        continue;
      }
      for (const name of names) {
        if (!provided.has(name)) {
          problems.push(`${where(consumer.repo, consumer.file)} calls '${name}', which ${where(c.provider.repo, c.provider.file)} does not define`);
        }
      }
    }
  },

  properties(c, problems) {
    const sass = need('theme', c.theme, problems);
    if (sass !== null) {
      const set = new Set([...code(sass).matchAll(/(--dre-search-bar-[a-z-]+)\s*:/g)].map((m) => m[1]));
      for (const name of c.names) if (!set.has(name)) problems.push(`${c.theme} no longer sets ${name}: drop it from the contract`);
      for (const name of set) if (!c.names.includes(name)) problems.push(`${c.theme} sets ${name}, which the contract does not list`);
    }
    if (!repo(c.repo).found) return;
    const svelte = need(c.repo, c.file, problems);
    if (svelte === null) return;
    for (const name of c.names) {
      if (!svelte.includes(`var(${name},`) && !svelte.includes(`var(${name})`)) {
        problems.push(`${where(c.repo, c.file)} no longer reads ${name}`);
      }
    }
  },

  listKeys(c, problems) {
    const text = need(c.repo, c.file, problems);
    if (text === null) return;
    const keys = listKeys(text, c.list);
    if (keys === null) {
      problems.push(`${where(c.repo, c.file)} has no list ${c.list}`);
    } else if (keys.join(',') !== c.keys.join(',')) {
      problems.push(`${where(c.repo, c.file)} ${c.list} is [${keys.join(', ')}], the contract says [${c.keys.join(', ')}]`);
    }
  },

  identical(c, problems) {
    const texts = c.files.map((f) => need(f.repo, f.file, problems));
    if (texts.includes(null)) return;
    if (texts.some((t) => t !== texts[0])) {
      problems.push(`${c.files.map((f) => where(f.repo, f.file)).join(' and ')} are no longer byte-identical`);
    }
  },

  registers(c, problems) {
    const table = need(c.repo, c.file, problems);
    const theme = need('theme', c.theme, problems);
    if (table === null || theme === null) return;
    const block = /REGISTERS\s*=\s*\[([\s\S]*?)\];/.exec(theme);
    const registers = new Map([...(block?.[1] ?? '').matchAll(/'([^']+)'\s*=>\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
    const authorities = [...code(table).matchAll(/'label'\s*=>\s*'([^']+)'[\s\S]*?'canonical'\s*=>\s*'([^']+)'/g)];
    if (!authorities.length) problems.push(`${where(c.repo, c.file)} lists no authorities with a label and a canonical IRI`);
    for (const [, label, canonical] of authorities) {
      const host = new URL(canonical.replace(/\$\d/g, 'x')).hostname;
      const match = [...registers].find(([h]) => host === h || host.endsWith(`.${h}`));
      if (!match) problems.push(`${c.theme} REGISTERS has no entry for ${host} (${label}), so its "Same as" link is labelled by its host`);
      else if (match[1] !== label) problems.push(`${c.theme} REGISTERS labels ${host} '${match[1]}', the identity table '${label}'`);
    }
  },
};

// --- Run ----------------------------------------------------------------------

const problems = [];
const skipped = new Map();
let ran = 0;

for (const entry of CONTRACT) {
  for (const check of entry.checks) {
    const run = CHECKS[check.type];
    if (!run) throw new Error(`${entry.id}: unknown check type '${check.type}'`);
    // A check partly on the theme still runs its theme half (members,
    // properties); the rest are skipped as a whole while a module is missing.
    const absent = reposOf(check).filter((key) => !repo(key).found);
    const partial = check.type === 'members' || check.type === 'properties';
    if (absent.length && !(partial && repo(check.provider?.repo ?? 'theme').found)) {
      for (const key of absent) skipped.set(key, (skipped.get(key) ?? 0) + 1);
      continue;
    }
    for (const key of absent) skipped.set(key, (skipped.get(key) ?? 0) + 1);
    const found = [];
    run(check, found);
    ran++;
    problems.push(...found.map((p) => `${entry.id}: ${p}`));
  }
}

// The document must name every entry and every property it lists.
const doc = read('theme', DOCUMENT);
if (doc === null) {
  problems.push(`${DOCUMENT} does not exist`);
} else {
  for (const entry of CONTRACT) {
    if (!doc.includes(`\`${entry.id}\``)) problems.push(`${DOCUMENT} does not name \`${entry.id}\``);
    for (const check of entry.checks) {
      for (const name of check.type === 'properties' ? check.names : []) {
        if (!doc.includes(`\`${name}\``)) problems.push(`${DOCUMENT} does not list \`${name}\``);
      }
    }
  }
}

for (const [key, count] of skipped) {
  console.warn(THEME_ONLY
    ? `  skipped (--theme-only): ${repo(key).path} — ${count} check(s) on it`
    : `  MISSING (not checked out): ${repo(key).path} — ${count} check(s) on it skipped`);
}
if (problems.length) {
  console.error(`\nIntegration contract: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`\nA name the theme and a module share changed on one side. Fix the side that drifted, or change\nthe contract in both repositories, ${DOCUMENT} and scripts/lib/integration-contract.mjs together.`);
}
if (skipped.size && CI) {
  console.error(`\n${skipped.size} module checkout(s) missing under CI=true: check them out beside DRE-theme.`);
}
if (problems.length || (skipped.size && CI)) process.exit(1);
console.log(`Integration contract: ${ran} check(s) on ${CONTRACT.length} entries passed`
  + (skipped.size ? `, ${[...skipped.values()].reduce((a, b) => a + b, 0)} skipped for ${THEME_ONLY ? '--theme-only' : 'missing modules'}.` : '.'));
