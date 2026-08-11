const { returnAllStationsLiterallyServices, returnAllStationsServices, returnAvailableStationsServices, returnInUseStationsServices, returnFaultyStationsServices, createStationServices, updateStationServices, deleteStationServices } = require('../services/stations')
const returnAllStationsLiterally = async (req, res, next) => {
    try {
        const { data, pagination } = await returnAllStationsLiterallyServices(req.query);
        res.status(200).json({
            success: true,
            data: data,
            pagination : pagination
        })
    }
    catch (err) {
        next(err)
    }
}
const returnAllStations = async (req, res, next) => {
    try {
        const { latitude, longitude, maxDistance } = req.query;
        const data = await returnAllStationsServices(Number(latitude), Number(longitude), Number(maxDistance));
        res.status(200).json({
            success: true,
            data: data
        })
    }
    catch (err) {
        next(err)
    }
}
const returnAvailableStations = async (req, res, next) => {
    try {
        const { latitude, longitude, maxDistance } = req.query;
        const data = await returnAvailableStationsServices(Number(latitude), Number(longitude), Number(maxDistance));
        res.status(200).json({
            success: true,
            data: data
        })
    }
    catch (err) {
        next(err)
    }
}
const returnInUseStations = async (req, res, next) => {
    try {
        const { latitude, longitude, maxDistance } = req.query;
        const data = await returnInUseStationsServices(Number(latitude), Number(longitude), Number(maxDistance));
        res.status(200).json({
            success: true,
            data: data
        })
    }
    catch (err) {
        next(err)
    }
}
const returnFaultyStations = async (req, res, next) => {
    try {
        const { latitude, longitude, maxDistance } = req.query;
        const data = await returnFaultyStationsServices(Number(latitude), Number(longitude), Number(maxDistance));
        res.status(200).json({
            success: true,
            data: data
        })
    }
    catch (err) {
        next(err)
    }
}

//admin only 
const createStation = async (req, res, next) => {
    try {
        const data = await createStationServices(req.body)
        res.status(200).json({
            success: true,
            data: data
        })
    }
    catch (err) {
        next(err)
    }
}

const updateStation = async (req, res, next) => {
    try {
        const data = await updateStationServices(req.params.id, req.body)
        res.status(200).json({
            success: true,
            data: data
        })
    }
    catch (err) {
        next(err)
    }
}

const deleteStation = async (req, res, next) => {
    try {
        const data = await deleteStationServices(req.params.id)
        res.status(200).json({
            success: true,
            data: data
        })
    }
    catch (err) {
        next(err)
    }
};

module.exports = { returnAllStationsLiterally, returnAllStations, returnAvailableStations, returnInUseStations, returnFaultyStations, createStation, updateStation, deleteStation }