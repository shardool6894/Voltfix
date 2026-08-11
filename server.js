const express = require('express')
const cors = require("cors");
const cookieParser = require('cookie-parser');
const path = require('path')
const app = express()
const { connectRedis } = require('./backend/config/redis')
const { connectDB } = require('./backend/config/database');
const { stationRouter } = require("./backend/routes/stations");
const { reportRouter } = require("./backend/routes/reports");
const { statRouter } = require("./backend/routes/stats");
const { authRouter } = require('./backend/routes/auth')
const { globalLimiter } = require('./backend/middleware/rateLimiter')
const { errorHandler } = require('./backend/services/error')
const dotenv = require('dotenv').config()

app.use(cors());
app.use(cookieParser(process.env.COOKIE_PARSER_Secret));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, 'frontend')))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', globalLimiter)
app.use("/api/stations", stationRouter);
app.use("/api/reports", reportRouter);
app.use("/api/stats", statRouter);
app.use('/api/auth', authRouter);
app.use(errorHandler);
(async () => {
    try {
        const databaseConnection = await connectDB();
        const redisConnection = await connectRedis();
        app.listen(5000, () => {
            console.log('server running on port 5000')
        })
    }
    catch (err) {
        console.log(`error:${err.message}`)
        process.exit(1)
    }
})();
module.exports = app;