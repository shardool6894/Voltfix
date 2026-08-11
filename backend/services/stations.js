const { connect } = require('node:http2');
const { chargingStationModel } = require('../models/stations');
const { getCache, setCache, invalidateCache, invalidateCacheByPrefix } = require('../utils/cache')

const returnAllStationsLiterallyServices = async () => {
    const cachedStations = getCache('stations:all');
    if (cachedStations) {
        return cachedStations;
    }
    else {
        const data = await chargingStationModel.find({})
        setCache('stations:all', data, 60 * 60 * 1000);
        return data;
    }
}
const returnAllStationsServices = async (latitude, longitude, maxDistance) => {
    const data = await chargingStationModel.find({
        location: {
            $near: {
                $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                $maxDistance: parseInt(maxDistance, 10)
            }
        }
    })
    return data;
}

const returnAvailableStationsServices = async (latitude, longitude, maxDistance) => {
    const unfilteredData = await returnAllStationsServices(latitude, longitude, maxDistance);
    const filteredData = unfilteredData.filter((element) => {
        return (element.status === "available")
    })
    return filteredData
}

const returnInUseStationsServices = async (latitude, longitude, maxDistance) => {
    const unfilteredData = await returnAllStationsServices(latitude, longitude, maxDistance);
    const filteredData = unfilteredData.filter((element) => {
        return (element.status === "in-use")
    })
    return filteredData
}

const returnFaultyStationsServices = async (latitude, longitude, maxDistance) => {
    const unfilteredData = await returnAllStationsServices(latitude, longitude, maxDistance);
    const filteredData = unfilteredData.filter((element) => {
        return (element.status === "fault")
    })
    return filteredData
}
//make admin access only
const createStationServices = async (data) => {
    const obj = {
        name: data.name,
        address: data.address,
        location: {
            type: data.location.type,
            coordinates: data.location.coordinates
        },
        connectors: data.connectors,
        status: data.status,
        network: data.network
    }
    const savedData = await chargingStationModel.create(obj);
    setCache(`station:${savedData._id}`, savedData, 60 * 60 * 1000);
    invalidateCache('stations:all');
    return savedData;
}

const updateStationServices = async (id, data) => {
    const obj = {
        id: data._id,
        name: data.name,
        address: data.address,
        location: {
            type: data.location.type,
            coordinates: data.location.coordinates
        },
        connectors: data.connectors,
        status: data.status,
        network: data.network
    }
    const checkExistingCache = getCache(`station:${obj.id}`);
    if (checkExistingCache) {
        invalidateCache(`station:${obj.id}`);
    }
    setCache(`station:${obj.id}`, obj, 60 * 60 * 1000);
    invalidateCache('stations:all');
    const updatedData = await chargingStationModel.findByIdAndUpdate(obj.id, obj, { new: true, runValidators: true })
    return updatedData;
}

const deleteStationServices = async (id) => {
    await chargingStationModel.findByIdAndDelete(id);
    invalidateCache(`station:${id}`);
    invalidateCache('stations:all');
    return 'deletion successful'
}
module.exports = { returnAllStationsLiterallyServices, returnAllStationsServices, returnAvailableStationsServices, returnInUseStationsServices, returnFaultyStationsServices, createStationServices, updateStationServices, deleteStationServices }