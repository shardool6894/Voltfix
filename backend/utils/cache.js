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
    catch(err){
        throw new Error(`error:${err.message}`)
    }
}

const searchGeoCache = async (key, latitude, longitude, maxDistance) => {
    try{
        await redisClient.GEOSEARCH(key,{
            longitude : parseFloat(longitude),latitude : parseFloat(latitude)
        },{radius: parseInt(maxDistance,10),unit : 'm'})
    }
    catch(err){
        throw new Error(`error:${err.message}`)
    }
}

const removeGeoCache = async (key) => {
    try{
        await redisClient.ZREM(key)
    }
    catch(err){
        throw new Error(`error:${err.message}`)
    }
}

module.exports = { getCache, setCache, invalidateCache, invalidateCacheByPrefix, addGeoCache, searchGeoCache, removeGeoCache }