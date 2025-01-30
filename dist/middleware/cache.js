import mcache from 'memory-cache';
/**
 * Cache middleware for Express routes
 * @param options Cache options including duration (in seconds) and optional key generator
 */
export const cache = (options) => {
    return (req, res, next) => {
        const key = typeof options.key === 'function'
            ? options.key(req)
            : options.key || req.originalUrl;
        const cachedBody = mcache.get(key);
        if (cachedBody) {
            res.send(cachedBody);
            return;
        }
        const originalSend = res.send.bind(res);
        res.send = ((body) => {
            mcache.put(key, body, options.duration * 1000);
            return originalSend(body);
        });
        next();
    };
};
/**
 * Clear cache for a specific key or pattern
 * @param key Cache key or pattern to clear
 */
export const clearCache = (key) => {
    mcache.del(key);
};
/**
 * Clear all cache
 */
export const clearAllCache = () => {
    mcache.clear();
};
//# sourceMappingURL=cache.js.map