/**
 * Where the sibling module checkouts live, relative to this repository.
 *
 * The local checkouts are named after their GitHub repositories (DRESearch,
 * DREVisualizations, DRE-LinkedData, DRE-SEO). CI's workflows check DRE Search out
 * under the older alias `DRE-Search`, so that name stays a fallback: the first
 * candidate that exists wins, and when none does the canonical name is
 * returned so a "not found" message names the folder a contributor should
 * create. Every script and test that reaches into a sibling resolves it here,
 * so the name cannot drift between them again (it did: vendor:lint silently
 * skipped DRE Search on every local machine).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const THEME_ROOT = resolve(import.meta.dirname, '..', '..');

export const SIBLINGS = {
  search: ['DRESearch', 'DRE-Search'],
  visualizations: ['DREVisualizations'],
  linkedData: ['DRE-LinkedData'],
  seo: ['DRE-SEO'],
};

/**
 * Absolute path of a sibling checkout, `{ path, found }`.
 *
 * @param {keyof typeof SIBLINGS} key
 * @param {string} [root] the theme checkout (defaults to this one)
 */
export function sibling(key, root = THEME_ROOT) {
  const names = SIBLINGS[key];
  if (!names) throw new Error(`Unknown sibling: ${key}`);
  for (const name of names) {
    const path = resolve(root, '..', name);
    if (existsSync(path)) return { path, found: true };
  }
  return { path: resolve(root, '..', names[0]), found: false };
}
