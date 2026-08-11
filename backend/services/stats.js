const { chargingStationModel } = require('../models/stations')
const { issueReportModel } = require('../models/reports')
const { getCache, setCache, invalidateCache, invalidateCacheByPrefix } = require('../utils/cache')
const { set } = require('mongoose')
const stationsTrackedServices = async function () {
    const cachedCount = getCache('stats:stationsCount')
    if (cachedCount !== undefined) {
        return cachedCount;
    }
    const count = await chargingStationModel.countDocuments();
    setCache('stats:stationsCount', count, 1000 * 60 * 60 * 24);
    return count;
}
const reportedTodayServices = async function () {
    // const date = new Date();
    // const all = await chargingStationModel.find({})
    // const reportedToday = all.filter((e)=>{
    //     ((e.createdAt.getDate() === date.getDate()) && (e.createdAt.getMonth() === date.getMonth()) && (e.createdAt.getFullYear() === date.getFullYear()))
    // })
    // return reportedToday;
    //the above one scans too much
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const data = await issueReportModel.find({
        createdAt: {
            $gte: start,
            $lte: end
        }
    })
    return data;
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
    return (await issueReportModel.find({
        status: { $in: ["resolved", "closed"] },
        updatedAt: {
            $gte: start,
            $lte: end
        }
    }));
}
module.exports = { stationsTrackedServices, reportedTodayServices, fixedThisWeekServices } 