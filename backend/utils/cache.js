const store = new Map();
const getCache = (key) => {
    const item = store.get(key);
    if (!item) {
        return undefined;
    }
    if (item.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
    }
    return item.value;
}
const setCache = (key, value, ttl) => {
    store.set(key, { value, expiresAt: Date.now() + ttl });
}

const invalidateCache = (key) => {
    store.delete(key);
}

const invalidateCacheByPrefix = (prefix) => {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
            store.delete(key);
        }
    }
}

module.exports = { getCache, setCache, invalidateCache, invalidateCacheByPrefix }