const {createClient} = require('redis')
const redisClient = createClient({url : process.env.REDIS_URL})
redisClient.on('connect', () => console.log('Redis connecting....'))
redisClient.on('ready', () => console.log('Redis connection ready'))
redisClient.on('error', (err) => console.log('Redis Client Error', err))
const connectRedis = async () => {
    try {
        await redisClient.connect();
    }
    catch(err) {
        console.error(err.message)
    }
}
module.exports = {connectRedis,redisClient};