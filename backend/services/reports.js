const { issueReportModel } = require('../models/reports')
const { chargingStationModel } = require('../models/stations')
const { getCache, setCache, invalidateCache, invalidateCacheByPrefix } = require('../utils/cache')
const getAllReportsServices = async () => {
    const cachedReports = getCache('reports:all');
    if (cachedReports) {
        return cachedReports;
    }
    else {
        const data = await issueReportModel.find({}).sort({ createdAt: -1 });
        setCache('reports:all', data, 60 * 60 * 1000);
        return data;
    }
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
    setCache(`report:${saveReport._id}`, saveReport, 60 * 60 * 1000);
    invalidateCache('reports:all');
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
    invalidateCache(`stats:fixedThisWeekCount:${start.getDate()}-${start.getMonth() + 1}-${start.getFullYear()}`, count, 60 * 60 * 1000);
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
    invalidateCache(`stats:fixedThisWeekCount:${start.getDate()}-${start.getMonth() + 1}-${start.getFullYear()}`, count, 60 * 60 * 1000);
    return report;
}
module.exports = { getAllReportsServices, createReportServices, updateReportStatusServices, dismissReportServices }