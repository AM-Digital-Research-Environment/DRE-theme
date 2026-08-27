/**
 * Representative AMIRA surfaces used by design audits and browser tests.
 *
 * Keep this inventory broader than the nightly smoke suite. `smoke: true`
 * marks the deliberately small production-monitoring sample; the remaining
 * entries are available for focused audit runs and manual evidence gathering.
 */
export const surfaceGroups = ['core', 'search', 'visualizations'];

export const surfaces = [
    {
        id: 'home',
        label: 'Home and collection overview',
        group: 'core',
        path: '/s/amira/page/home',
        mode: 'stable',
        owners: ['DRE-theme', 'DRESearch', 'DRE-Visualizations'],
        selectors: ['h1', 'header', 'main', 'footer'],
        states: ['light', 'dark', 'mobile navigation', 'visualizations loading'],
        smoke: true,
    },
    {
        id: 'research-gateway',
        label: 'Research gateway',
        group: 'core',
        path: '/s/amira/page/research',
        mode: 'stable',
        owners: ['DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['light', 'dark', 'mobile'],
        smoke: false,
    },
    {
        id: 'index-gateway',
        label: 'Index gateway',
        group: 'core',
        path: '/s/amira/page/index',
        mode: 'stable',
        owners: ['DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['light', 'dark', 'mobile'],
        smoke: false,
    },
    {
        id: 'item-browse',
        label: 'Item browse',
        group: 'core',
        path: '/s/amira/item',
        mode: 'stable',
        owners: ['DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['results', 'pagination', 'empty'],
        smoke: true,
    },
    {
        id: 'item-record',
        label: 'Representative item record',
        group: 'core',
        path: '/s/amira/item/9754',
        mode: 'stable-sample',
        owners: ['DRE-theme', 'DRE-Visualizations'],
        selectors: ['h1', 'main'],
        states: ['rich metadata', 'linked resources', 'visualizations'],
        smoke: true,
    },
    {
        id: 'item-set-browse',
        label: 'Item-set browse',
        group: 'core',
        path: '/s/amira/item-set',
        mode: 'stable',
        owners: ['DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['results', 'pagination', 'empty'],
        smoke: true,
    },
    {
        id: 'media-record',
        label: 'API-resolved media record',
        group: 'core',
        path: '/s/amira/media/{id}',
        mode: 'api-resolved',
        resolve: { endpoint: '/api/media?per_page=1', idProperty: 'o:id' },
        owners: ['DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['media available', 'metadata'],
        smoke: true,
    },
    {
        id: 'federated-search',
        label: 'Federated DRE Search',
        group: 'search',
        path: '/s/amira/dre-search',
        mode: 'stable',
        owners: ['DRESearch', 'DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['initial', 'results', 'zero results', 'unavailable'],
        smoke: true,
    },
    ...[
        ['research-items', 'Research items', '/s/amira/page/research-items'],
        ['research-projects', 'Research projects', '/s/amira/page/research-projects'],
        ['people', 'People', '/s/amira/page/people'],
        ['organisations', 'Organisations', '/s/amira/page/organisations'],
        ['locations', 'Locations', '/s/amira/page/locations'],
        ['subjects-tags', 'Subjects and tags', '/s/amira/page/subjects-tags'],
        ['publications', 'Publications', '/s/amira/page/publications'],
        ['podcasts', 'Podcasts', '/s/amira/page/podcasts'],
        ['youtube-videos', 'YouTube videos', '/s/amira/page/youtube-videos'],
    ].map(([id, label, path]) => ({
        id,
        label,
        group: 'search',
        path,
        mode: 'stable',
        owners: ['DRESearch', 'DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['initial', 'results', 'filtered', 'zero results', 'unavailable'],
        smoke: false,
    })),
    ...[
        ['project-explorer', 'Project explorer', '/s/amira/page/project-explorer'],
        ['compare', 'Compare', '/s/amira/page/compare'],
        ['spatial-exploration', 'Spatial exploration', '/s/amira/page/spatial-exploration'],
        ['networks', 'Networks', '/s/amira/page/networks'],
        ['publications-visualisations', 'Publications analytics', '/s/amira/page/publications-visualisations'],
        ['podcasts-visualisations', 'Podcast analytics', '/s/amira/page/podcasts-visualisations'],
        ['youtube-visualisations', 'YouTube analytics', '/s/amira/page/youtube-visualisations'],
    ].map(([id, label, path]) => ({
        id,
        label,
        group: 'visualizations',
        path,
        mode: 'stable',
        owners: ['DRE-Visualizations', 'DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['loading', 'ready', 'empty', 'failed request'],
        smoke: ['project-explorer', 'spatial-exploration', 'networks'].includes(id),
    })),
];

export function getSurface(id) {
    const surface = surfaces.find((candidate) => candidate.id === id);
    if (!surface) throw new Error(`Unknown AMIRA surface: ${id}`);
    return surface;
}

export function smokeSurfaces(group) {
    return surfaces.filter((surface) => surface.group === group && surface.smoke && surface.mode !== 'api-resolved');
}
