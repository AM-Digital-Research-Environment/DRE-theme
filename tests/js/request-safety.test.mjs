import assert from 'node:assert/strict';
import test from 'node:test';

import { productionRequestDecision } from '../browser/production-request-policy.mjs';

const baseURL = 'https://data.africamultiple.uni-bayreuth.de';
const json = { 'content-type': 'application/json' };

test('production guard permits inherently safe request methods', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        assert.deepEqual(
            productionRequestDecision(method, `${baseURL}/s/amira/page/home`, {}, baseURL),
            { allowed: true, reason: 'safe-method' },
        );
    }
});

test('production guard narrowly permits anonymous DRESearch query posts', () => {
    for (const path of [
        '/dre-search/api/search',
        '/dre-search/api/suggest',
        '/dre-search/api/suggest-all',
        '/dre-search/api/search-all',
        '/dre-search/api/union',
        '/dre-search/api/map',
    ]) {
        assert.deepEqual(
            productionRequestDecision('POST', `${baseURL}${path}`, json, baseURL),
            { allowed: true, reason: 'read-only-search-post' },
        );
    }
});

test('production guard rejects every unverified write-shaped request', () => {
    for (const candidate of [
        ['POST', `${baseURL}/api/items`, json],
        ['POST', `${baseURL}/dre-search/api/export`, json],
        ['POST', `${baseURL}/dre-search/api/search-all/delete`, json],
        ['POST', 'https://example.org/dre-search/api/search-all', json],
        ['POST', `${baseURL}/dre-search/api/search-all`, { 'content-type': 'text/plain' }],
        ['POST', `${baseURL}/dre-search/api/search-all`, { ...json, authorization: 'Bearer secret' }],
        ['PUT', `${baseURL}/dre-search/api/search-all`, json],
        ['PATCH', `${baseURL}/s/amira/page/home`, json],
        ['DELETE', `${baseURL}/api/items/1`, {}],
    ]) {
        assert.deepEqual(
            productionRequestDecision(...candidate, baseURL),
            { allowed: false, reason: 'potential-mutation' },
        );
    }
});
