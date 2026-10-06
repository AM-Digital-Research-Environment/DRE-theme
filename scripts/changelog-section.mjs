#!/usr/bin/env node
/**
 * CHANGELOG.md (Keep a Changelog) helpers.
 *
 *   node scripts/changelog-section.mjs <version>   print that version's notes
 *
 * release.yml uses the CLI to write the notes of a release it has to create;
 * scripts/sync-version.mjs uses promoteUnreleased() when `npm version` bumps.
 * Exit code 1 when the version has no section, or an empty one.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY = 'https://github.com/AM-Digital-Research-Environment/DRE-theme';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headingRe = (name) => new RegExp(`^## \\[${escape(name)}\\][^\\n]*\\n`, 'm');

/**
 * Body of `## [name]` up to the next `## ` heading or link reference block,
 * without HTML comments (editing placeholders), trimmed.
 */
export function changelogSection(text, name) {
    const source = text.replace(/\r\n/g, '\n');
    const heading = source.match(headingRe(name));
    if (!heading) return null;
    const rest = source.slice(heading.index + heading[0].length);
    const end = rest.search(/^## |^\[[^\]]+\]: /m);
    return (end === -1 ? rest : rest.slice(0, end)).replace(/<!--[\s\S]*?-->/g, '').trim();
}

/**
 * Turn the [Unreleased] notes into a `## [version] - date` section, leave an
 * empty [Unreleased] above it, and update the link references at the bottom.
 * Returns the text unchanged when the version already has a section or there
 * is nothing unreleased to promote.
 */
export function promoteUnreleased(text, version, date) {
    const source = text.replace(/\r\n/g, '\n');
    if (headingRe(version).test(source)) return source;
    const unreleased = source.match(headingRe('Unreleased'));
    const notes = changelogSection(source, 'Unreleased');
    if (!unreleased || !notes) return source;

    // The notes move under the new heading; an HTML-comment placeholder stays
    // behind under [Unreleased] for the next round.
    const at = unreleased.index + unreleased[0].length;
    const rest = source.slice(at);
    const end = rest.search(/^## |^\[[^\]]+\]: /m);
    const body = end === -1 ? rest : rest.slice(0, end);
    const placeholders = (body.match(/<!--[\s\S]*?-->/g) ?? []).join('\n');
    let out = `${source.slice(0, at)}\n${placeholders ? placeholders + '\n\n' : ''}` +
        `## [${version}] - ${date}\n\n${notes}\n\n${end === -1 ? '' : rest.slice(end)}`;

    const previous = out.match(/^\[Unreleased\]: .*\/compare\/(v[^.\s]+\.[^.\s]+\.[^.\s]+)\.\.\.HEAD$/m)?.[1];
    out = out.replace(/^\[Unreleased\]: .*$/m, `[Unreleased]: ${REPOSITORY}/compare/v${version}...HEAD`);
    const reference = previous
        ? `[${version}]: ${REPOSITORY}/compare/${previous}...v${version}`
        : `[${version}]: ${REPOSITORY}/releases/tag/v${version}`;
    out = out.replace(/^(\[Unreleased\]: .*)$/m, `$1\n${reference}`);
    return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const version = process.argv[2]?.replace(/^v/, '');
    if (!version) {
        console.error('Usage: node scripts/changelog-section.mjs <version>');
        process.exit(2);
    }
    const text = readFileSync(join(import.meta.dirname, '..', 'CHANGELOG.md'), 'utf8');
    const notes = changelogSection(text, version);
    if (!notes) {
        console.error(`CHANGELOG.md has no notes for ${version}.`);
        process.exit(1);
    }
    process.stdout.write(notes + '\n');
}
