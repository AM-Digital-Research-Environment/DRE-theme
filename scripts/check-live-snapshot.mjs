#!/usr/bin/env node
// Read-only deployment gate: no credentials, mutations, or browser required.
const base = process.env.LIVE_BASE_URL || 'https://data.africamultiple.uni-bayreuth.de';
const root = new URL('/modules/DreVisualizations/asset/data/', base);
async function json(path) {
    const response = await fetch(new URL(path, root), {
        cache: 'no-store', signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${response.status}: ${response.url}`);
    return response.json();
}
try {
    const manifest = await json('current.json');
    if (!/^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$/.test(manifest.generationId)) {
        throw new Error('Invalid generation identifier');
    }
    for (const path of ['item-dashboards/collection-overview.json', 'item-dashboards/projects-index.json', 'network-explorer.json', 'communities/entity-graph.json']) {
        const data = await json(`generations/${manifest.generationId}/${path}`);
        if (!data || typeof data !== 'object') throw new Error(`Invalid dataset: ${path}`);
        if (path.endsWith('collection-overview.json') && !(data.totalItems > 0)) throw new Error('Empty overview');
        if (path.endsWith('entity-graph.json') && !data.nodes?.length) throw new Error('Empty entity network');
    }
    console.log(JSON.stringify({ healthy: true, generation: manifest.generationId, createdAt: manifest.createdAt, moduleVersion: manifest.moduleVersion }, null, 2));
} catch (error) {
    console.error(`Snapshot health gate failed: ${error.message}`);
    process.exitCode = 1;
}
