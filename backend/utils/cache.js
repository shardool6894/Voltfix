const { redisClient } = require('../config/redis')
const store = new Map();
const getCache = (key) => {
    try {
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
    catch (err) {
        throw new Error(`error:${err.message}`)
    }
}
const setCache = (key, value, ttl) => {
    try {
        store.set(key, { value, expiresAt: Date.now() + ttl });
    }
    catch (err) {
        throw new Error(`error:${err.message}`)
    }
}

const invalidateCache = (key) => {
    try {
        store.delete(key);
    }
    catch (err) {
        throw new Error(`error:${err.message}`)
    }
}

const invalidateCacheByPrefix = (prefix) => {
    try {
        for (const key of store.keys()) {
            if (key.startsWith(prefix)) {
                store.delete(key);
            }
        }
    }
    catch (err) {
        throw new Error(`error:${err.message}`)
    }
}

const addGeoCache = async (key, latitude, longitude) => {
    try {
        await redisClient.GEOADD(key, {
            longitude: parseFloat(longitude),
            latitude: parseFloat(latitude)
        })
    }
    catch (err) {
        throw new Error(`error:${err.message}`)
    }
}

const searchGeoCache = async (key, latitude, longitude, maxDistance) => {
    try {
        return await redisClient.GEOSEARCH(key, {
            longitude: parseFloat(longitude), latitude: parseFloat(latitude)
        }, { radius: parseInt(maxDistance, 10), unit: 'm' })
    }
    catch (err) {
        throw new Error(`error:${err.message}`)
    }
}

const removeGeoCache = async (key) => {
    try {
        await redisClient.ZREM(key)
    }
    catch (err) {
        throw new Error(`error:${err.message}`)
    }
}

const activeQueries = new Map();

//strict one 
const fetchWithDeduplication = async (cacheKey, ttl, dbQueryFunction) => {
    const cachedData = getCache(cacheKey);
    if (cachedData) {
        return cachedData
    }
    if (activeQueries.has(cacheKey)) {
        console.log(`preventing stampede for ${cacheKey}`)
        return activeQueries.get(cacheKey)
    }
    const queryPromise = dbQueryFunction().then((data) => {
        setCache(cacheKey, data, ttl * 1000)
        activeQueries.delete(cacheKey)
        return data;
    }).catch((err) => {
        activeQueries.delete(cacheKey)
        throw new Error(`error : ${err.message}`)
    })
    activeQueries.set(cacheKey, queryPromise)
    return await queryPromise;
}

//stale data fetching in the meantime
const fetchStaleDataWhileRevalidate = async (cacheKey, dbQueryFunction) => {
    const cachedData = getCache(cacheKey)
    if (cachedData) {
        if (Date.now() > cachedData.staleAt) {
            dbQueryFunction().then((freshData) => {
                setCache(cacheKey, {
                    data: freshData,
                    staleAt: Date.now() + (5 * 60 * 1000)
                })
            })
        }
        return cachedData.data;
    }
    const freshData = await dbQueryFunction();
    setCache(cacheKey, {
        data: freshData,
        staleAt: Date.now() + (5 * 60 * 1000)
    })
    return freshData;
}

module.exports = { getCache, setCache, invalidateCache, invalidateCacheByPrefix, addGeoCache, searchGeoCache, removeGeoCache, fetchWithDeduplication, fetchStaleDataWhileRevalidate }