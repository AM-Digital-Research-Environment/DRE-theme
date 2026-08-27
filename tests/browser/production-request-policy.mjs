const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const readOnlyJsonPostPaths = new Set([
    '/dre-search/api/search',
    '/dre-search/api/suggest',
    '/dre-search/api/suggest-all',
    '/dre-search/api/search-all',
    '/dre-search/api/union',
    '/dre-search/api/map',
]);

export function productionRequestDecision(method, url, headers = {}, baseURL) {
    const normalizedMethod = method.toUpperCase();
    if (safeMethods.has(normalizedMethod)) return { allowed: true, reason: 'safe-method' };

    const requestUrl = new URL(url);
    const targetOrigin = new URL(baseURL).origin;
    const contentType = headers['content-type'] || headers['Content-Type'] || '';
    const hasAuthorization = Boolean(headers.authorization || headers.Authorization);
    const isReadOnlySearchPost = normalizedMethod === 'POST'
        && requestUrl.origin === targetOrigin
        && readOnlyJsonPostPaths.has(requestUrl.pathname)
        && contentType.toLowerCase().startsWith('application/json')
        && !hasAuthorization;

    if (isReadOnlySearchPost) return { allowed: true, reason: 'read-only-search-post' };
    return { allowed: false, reason: 'potential-mutation' };
}
