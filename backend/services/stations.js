const { chargingStationModel } = require('../models/stations');
const { getCache, setCache, invalidateCache, invalidateCacheByPrefix, addGeoCache, searchGeoCache, removeGeoCache, fetchWithDeduplication, fetchStaleDataWhileRevalidate } = require('../utils/cache');

const returnAllStationsLiterallyServices = async (queryParams) => {
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
    const cacheKey = `stations:${page}:${limit}:${sort}:${searchKeywords}`;
    return await fetchStaleDataWhileRevalidate(cacheKey, 3600, async () => {
        const [data, totalData] = await Promise.all([chargingStationModel.find(query).sort(sort).skip(skip).limit(limit), chargingStationModel.countDocuments(query)])
        setCache(cacheKey, data, 60 * 60 * 1000);
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
const returnAllStationsServices = async (latitude, longitude, maxDistance) => {
    const nearbyIds = await searchGeoCache(`station:geoCache`, longitude, latitude, maxDistance);
    if (nearbyIds && nearbyIds.length > 0) {
        const stations = await Promise.all(
            nearbyIds.map(async (id) => {
                let station = getCache(`station:${id}`);
                if (!station) {
                    station = await chargingStationModel.findById(id).lean();
                    if (station) setCache(`station:${id}`, station, 60 * 60 * 1000);
                }
                return station;
            })
        )
        return stations.filter(Boolean);
    }
    const data = await chargingStationModel.find({
        location: {
            $near: {
                $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                $maxDistance: parseInt(maxDistance, 10)
            }
        }
    }).lean();
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
    const newKey = `stations:1:10:-createdAt`
    const currentCache = getCache(newKey);
    if(currentCache && currentCache.data && currentCache.data.data){
        currentCache.data.data.unshift(savedData);
        setCache(newKey, currentCache, 60*60*1000);
    }else{
        invalidateCacheByPrefix('stations:')
    }
    addGeoCache(`station:geoCache`, savedData.location.coordinates[0], savedData.location.coordinates[1], savedData._id)
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
    const updatedData = await chargingStationModel.findByIdAndUpdate(obj.id, obj, { new: true, runValidators: true })
    setCache(`station:${updatedData._id}`, updatedData, 60 * 60 * 1000);
    invalidateCache('stations:all');
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
    addGeoCache(`station:geoCache`, updatedData.location.coordinates[0], updatedData.location.coordinates[1], updatedData._id)
    return updatedData;
}

const deleteStationServices = async (id) => {
    await chargingStationModel.findByIdAndDelete(id);
    await removeGeoCache(`station:geoCache`, id);
    invalidateCache(`station:${id}`);
    invalidateCache('stations:all');
    return 'deletion successful'
}
module.exports = { returnAllStationsLiterallyServices, returnAllStationsServices, returnAvailableStationsServices, returnInUseStationsServices, returnFaultyStationsServices, createStationServices, updateStationServices, deleteStationServices }