import assert from 'node:assert/strict';
import test from 'node:test';

import { surfaceGroups, surfaces } from '../browser/surfaces.mjs';

test('surface manifest has unique ids and stable ownership metadata', () => {
    assert.ok(surfaces.length >= 20, 'the representative inventory unexpectedly shrank');
    assert.equal(new Set(surfaces.map(({ id }) => id)).size, surfaces.length, 'surface ids must be unique');

    for (const surface of surfaces) {
        assert.match(surface.id, /^[a-z0-9-]+$/);
        assert.ok(surfaceGroups.includes(surface.group), `${surface.id} has an unknown group`);
        assert.match(surface.path, /^\/s\/amira\//);
        assert.ok(surface.owners.length > 0, `${surface.id} needs an owner`);
        assert.ok(surface.selectors.includes('h1'), `${surface.id} needs a document-heading contract`);
        assert.ok(surface.states.length > 0, `${surface.id} needs at least one state`);
        assert.equal(typeof surface.smoke, 'boolean', `${surface.id} needs an explicit smoke decision`);
        if (surface.mode === 'api-resolved') {
            assert.ok(surface.resolve?.endpoint, `${surface.id} needs an API endpoint`);
            assert.match(surface.path, /\{id\}/, `${surface.id} needs an id placeholder`);
        }
    }
});

test('nightly surface sample covers every owner and group', () => {
    const smoke = surfaces.filter(({ smoke }) => smoke);
    for (const group of surfaceGroups) {
        assert.ok(smoke.some((surface) => surface.group === group), `${group} has no smoke surface`);
    }
    for (const owner of ['DRE-theme', 'DRESearch', 'DRE-Visualizations']) {
        assert.ok(smoke.some((surface) => surface.owners.includes(owner)), `${owner} has no smoke surface`);
    }
});
