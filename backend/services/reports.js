const { issueReportModel } = require('../models/reports')
const { chargingStationModel } = require('../models/stations')
const { getCache, setCache, invalidateCache, invalidateCacheByPrefix, addGeoCache, searchGeoCache, removeGeoCache, fetchWithDeduplication, fetchStaleDataWhileRevalidate } = require('../utils/cache')
const getAllReportsServices = async (queryParams) => {
    const page = queryParams.page || 1;
    const limit = queryParams.limit || 10;
    const skip = (page - 1) * limit;
    const sort = queryParams.sort || '-createdAt';
    const searchKeywords = queryParams.search || '';
    let query = {}
    if (searchKeywords) {
        query.$or = [
            { name: { $regex: searchKeywords, $options: 'i' } },
            { address: { $regex: searchKeywords, $options: 'i' } }
        ]
    }
    const cacheKey = `reports:${page}:${limit}:${sort}:${searchKeywords}`;
    return await fetchStaleDataWhileRevalidate(cacheKey, 3600, async () => {
        const [data, totalData] = await Promise.all([await issueReportModel.find(query).sort(sort).skip(skip).limit(limit), chargingStationModel.countDocuments(query)]);
        setCache('reports:all', data, 60 * 60 * 1000);
        const returnValue = {
            data, pagination: {
                totalItems: totalData,
                totalPages: Math.ceil(totalData / limit),
                currentPage: page,
                itemsPerPage: limit
            }
        };
        return returnValue;
    })
}
const createReportServices = async (data) => {
    const trimmedName = data.stationName.trim();
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const station = await chargingStationModel.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${escapedName}$`, "i") } },
        { status: "fault" },
        { returnDocument: "after" }
    )
    if (!station) {
        throw new Error('station not registered')
    }
    const report = {
        stationName: station.name,
        issueType: data.issueType,
        description: data.description,
        reporterName: data.reporterName?.trim() || "Anonymous",
        photo: data.photo || 'No photo',
    };
    const saveReport = await issueReportModel.create(report);
    const newKey = `reports:1:10:-createdAt`
    const currentCache = getCache(newKey);
    if (currentCache && currentCache.data && currentCache.data.data) {
        currentCache.data.data.unshift(savedData);
        setCache(newKey, currentCache, 60 * 60 * 1000);
    } else {
        invalidateCacheByPrefix('reports:')
    }
    setCache(`report:${saveReport._id}`, saveReport, 60 * 60 * 1000);
    return saveReport
}

const updateReportStatusServices = async (userid, reportid, stationStatus) => {
    const report = await issueReportModel.findById(reportid);
    if (!report) {
        throw new Error('report not found')
    }
    report.status = "resolved";
    report.resolvedAt = new Date();
    report.resolvedBy = userid;
    await report.save();
    const updatedReport = await chargingStationModel.findOneAndUpdate(
        { name: report.stationName },
        { status: stationStatus }, { returnDocument: "after" }
    );
    setCache(`report:${updatedReport._id}`, updatedReport, 60 * 60 * 1000);
    invalidateCache('reports:all');
    const date = new Date();
    let start = new Date(date);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) {
        start.setDate(date.getDate() - 6)
    }
    else {
        start.setDate(date.getDate() - dayOfWeek + 1);
    }
    start.setHours(0, 0, 0, 0)
    invalidateCache(`stats:fixedThisWeekCount:${start.getDate()}-${start.getMonth() + 1}-${start.getFullYear()}`);
    return updatedReport;
}
const dismissReportServices = async (userId, reportId) => {
    const report = await issueReportModel.findById(reportId);
    if (!report) {
        throw new Error('Report not found');
    }
    report.status = "closed";
    report.dismissedAt = new Date();
    report.dismissedBy = userId;
    await report.save();
    setCache(`report:${reportId}`, report, 60 * 60 * 1000);
    invalidateCache('reports:all');
    const date = new Date();
    let start = new Date(date);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) {
        start.setDate(date.getDate() - 6)
    }
    else {
        start.setDate(date.getDate() - dayOfWeek + 1);
    }
    start.setHours(0, 0, 0, 0)
    invalidateCache(`stats:fixedThisWeekCount:${start.getDate()}-${start.getMonth() + 1}-${start.getFullYear()}`);
    return report;
}
module.exports = { getAllReportsServices, createReportServices, updateReportStatusServices, dismissReportServices }