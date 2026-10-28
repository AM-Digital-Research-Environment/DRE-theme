/**
 * Advisories `npm run audit:deps` lets through at high or critical severity.
 *
 * An entry is an admission, not a fix: it has to say why no upgrade clears the
 * advisory and why the vulnerable code cannot be reached. scripts/check-audit.mjs
 * retires entries on its own — it fails as soon as npm can fix an excepted
 * advisory in range, and as soon as one stops appearing — so this list cannot
 * outlive its reason the way a hand-kept ignore list would.
 *
 * Keyed by the GitHub advisory id, the last segment of the advisory's URL:
 *
 *   'GHSA-xxxx-xxxx-xxxx': {
 *       package: 'name',
 *       reason: 'No patched release; reached only by <dev tool> at build time, never by served code.',
 *   },
 */
export default {};
