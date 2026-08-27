import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fixture = readFileSync(
    new URL('../fixtures/design-system/index.html', import.meta.url),
    'utf8',
);

test('the visualization fixture separates its heading and action toolbar', () => {
    const heading = fixture.match(/<h3 id="chart-shell-title">([\s\S]*?)<\/h3>/);

    assert.ok(heading, 'the fixture needs its canonical visualization heading');
    assert.equal(heading[1], 'Collection over time');
    assert.doesNotMatch(heading[1], /<button\b/i);
    assert.match(
        fixture,
        /role="toolbar" aria-label="Chart actions: Collection over time"/,
    );
});

test('the visualization fixture keeps a polite atomic status region', () => {
    assert.match(
        fixture,
        /class="sr-only" role="status" aria-live="polite" aria-atomic="true">Visualisations ready\.<\/p>/,
    );
});
