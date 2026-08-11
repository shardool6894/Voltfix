const { chargingStationModel } = require('../models/stations')
const { issueReportModel } = require('../models/reports')
const { getCache, setCache, invalidateCache, invalidateCacheByPrefix, addGeoCache, searchGeoCache, removeGeoCache, fetchWithDeduplication, fetchStaleDataWhileRevalidate } = require('../utils/cache')
const { set } = require('mongoose')
const { cache } = require('react')
const stationsTrackedServices = async function () {
    const cacheKey = 'stats:stationsCount'
    const cachedCount = getCache(cacheKey)
    if (cachedCount) {
        return cachedCount;
    }
    fetchStaleDataWhileRevalidate(cacheKey, 3600, () => {
        const count = await chargingStationModel.countDocuments();
        setCache(cacheKey, count, 1000 * 60 * 60 * 24);
        return count;
    })
}
const reportedTodayServices = async function () {
    // const date = new Date();
    // const all = await chargingStationModel.find({})
    // const reportedToday = all.filter((e)=>{
    //     ((e.createdAt.getDate() === date.getDate()) && (e.createdAt.getMonth() === date.getMonth()) && (e.createdAt.getFullYear() === date.getFullYear()))
    // })
    // return reportedToday;
    //the above one scans too much
    const date = new Date();
    const cacheKey = `stats:reportedTodayCount:${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`
    const cachedCount = getCache(cacheKey);
    if (cachedCount) {
        return count;
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    fetchStaleDataWhileRevalidate(cacheKey, 3600, () => {
        const count = await issueReportModel.countDocuments({
            createdAt: {
                $gte: start,
                $lte: end
            }
        });
        setCache(cacheKey, count, 60 * 60 * 1000);
        return count;
    })
}
const fixedThisWeekServices = async function () {
    const date = new Date();
    const dayOfWeek = date.getDay();
    let start = new Date(date);
    if (dayOfWeek === 0) {
        start.setDate(date.getDate() - 6)
    }
    else {
        start.setDate(date.getDate() - dayOfWeek + 1);
    }
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const cacheKey = `stats:fixedThisWeekCount:${start.getDate()}-${start.getMonth() + 1}-${start.getFullYear()}`;
    const cachedCount = getCache(cacheKey);
    if (cachedCount) {
        return cachedCount;
    }
    fetchStaleDataWhileRevalidate(cacheKey, 3600, () => {
        const count = await issueReportModel.countDocuments({
            status: { $in: ["resolved", "closed"] },
            updatedAt: {
                $gte: start,
                $lte: end
            }
        });
        setCache(cacheKey, count, 60 * 60 * 1000);
        return count;
    })
}
module.exports = { stationsTrackedServices, reportedTodayServices, fixedThisWeekServices } 