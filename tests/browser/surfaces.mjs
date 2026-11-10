/**
 * Representative AMIRA surfaces used by design audits and browser tests.
 *
 * Keep this inventory broader than the nightly smoke suite. `smoke: true`
 * marks the deliberately small production-monitoring sample; the remaining
 * entries are available for focused audit runs and manual evidence gathering.
 */
import { amiraPagePath } from '../../scripts/lib/amira-pages.mjs';

// AMIRA page paths come from config/amira-pages.php, the slugs the theme's
// menu and banner link to, so the inventory cannot name a page the theme
// does not. The home page is Omeka's, not one of them.
const page = (slug) => amiraPagePath(slug);

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
        path: page('research'),
        mode: 'stable',
        owners: ['DRE-theme'],
        selectors: [
            'h1',
            'main',
            `a[href$="${page('research-sections')}"]`,
            `a[href$="${page('research-projects')}"]`,
            `a[href$="${page('research-items')}"]`,
        ],
        states: ['light', 'dark', 'mobile'],
        smoke: false,
    },
    {
        id: 'index-gateway',
        label: 'Index gateway',
        group: 'core',
        path: page('index'),
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
        label: 'Canonical Mirador item record',
        group: 'core',
        path: '/s/amira/item/32328',
        mode: 'stable-sample',
        owners: ['DRE-theme', 'DRE-Visualizations', 'Mirador'],
        selectors: ['h1', 'main', '.block-mirador', '[aria-label="Workspace"]'],
        states: ['Mirador ready', 'rich metadata', 'linked resources', 'visualizations'],
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
        // DRE-SEO marks media pages `noindex, follow`: the item page is the one to index.
        indexable: false,
    },
    {
        id: 'federated-search',
        label: 'Federated DRE Search',
        group: 'search',
        path: '/s/amira/dre-search',
        mode: 'stable',
        owners: ['DRESearch', 'DRE-theme'],
        selectors: ['h1', 'main', '.dre-search', '.dre-search__facets', '.dre-search__results'],
        states: ['initial', 'results', 'zero results', 'unavailable'],
        smoke: true,
        // federated.phtml sets `noindex,follow`; search results are not landing pages.
        indexable: false,
    },
    ...[
        ['research-items', 'Research items'],
        ['research-projects', 'Research projects'],
        ['people', 'People'],
        ['organisations', 'Organisations'],
        ['locations', 'Locations'],
        ['subjects-tags', 'Subjects and tags'],
        ['publications', 'Publications'],
        ['podcasts', 'Podcasts'],
        ['youtube-videos', 'YouTube videos'],
    ].map(([id, label]) => ({
        id,
        label,
        group: 'search',
        path: page(id),
        mode: 'stable',
        owners: ['DRESearch', 'DRE-theme'],
        selectors: ['h1', 'main'],
        states: ['initial', 'results', 'filtered', 'zero results', 'unavailable'],
        smoke: false,
    })),
    ...[
        ['project-explorer', 'Project explorer'],
        ['compare', 'Compare'],
        ['spatial-exploration', 'Spatial exploration'],
        ['networks', 'Networks'],
        ['publications-visualisations', 'Publications analytics'],
        ['podcasts-visualisations', 'Podcast analytics'],
        ['youtube-visualisations', 'YouTube analytics'],
    ].map(([id, label]) => ({
        id,
        label,
        group: 'visualizations',
        path: page(id),
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
