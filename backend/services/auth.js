const { userModel } = require('../models/users')
const crypto = require('crypto')
const { getCache, setCache, invalidateCache, invalidateCacheByPrefix, addGeoCache, searchGeoCache, removeGeoCache, fetchWithDeduplication, fetchStaleDataWhileRevalidate } = require('../utils/cache')

const registerServices = async (userData) => {
    const existingUser = await userModel.findByEmail(userData.email)
    if (existingUser) {
        throw new Error('email taken')
    }
    const email = userData.email.trim().toLowerCase();
    let role = 'driver'
    if (userData.adminSecret && process.env.ADMIN_SECRET) {
        const providedSecret = Buffer.from(userData.adminSecret);
        const actualSecret = Buffer.from(process.env.ADMIN_SECRET);
        if (providedSecret.length === actualSecret.length &&
            crypto.timingSafeEqual(providedSecret, actualSecret)) {
            role = 'admin';
        }
        //entire logic so that attacker cannot get the admin secret by timing brute force
    }

    const user = new userModel({
        name: userData.name,
        email,
        password: userData.password,
        role,
    })
    await user.save()
    return user;
}

const loginServices = async (userData) => {
    const user = await userModel.findByEmail(userData.email);
    if (!user) {
        throw new Error('Email or Password is incorrect')
    }
    const isMatchingPassword = await user.comparePassword(userData.password)
    if (!isMatchingPassword) {
        throw new Error('Email or Password is incorrect')
    }
    const authToken = user.signAuthToken();
    const refreshToken = user.signRefreshToken();
    setCache(`user:${user._id}`, user, 60 * 60 * 1000);
    return { user, authToken, refreshToken };
}

const getProfileServices = async (userId) => {
    const cachedUser = getCache(`user:${userId}`);
    if (!cachedUser) {
        const user = await userModel.findById(userId).lean();
        if (!user) {
            throw new Error("User not found");
        }
        setCache(`user:${userId}`, user, 60 * 60 * 1000);
        return user;
    }
    return cachedUser;
}

const updateProfileServices = async (userId, newData) => {
    delete newData.password;
    delete newData.email;
    delete newData.role;
    const updatedUser = await userModel.findByIdAndUpdate(userId, {
        $set: newData
    },
        {
            new: true,
            runValidators: true
        }).lean();
    if (!updatedUser) {
        throw new Error('user not found')
    }
    setCache(`user:${userId}`, updatedUser, 60 * 60 * 1000);
    return updatedUser;
}

const changePasswordServices = async (userId, currentPassword, newPassword) => {
    if (currentPassword === newPassword) {
        throw new Error(`New password cannot be the same as before`)
    }
    let user = await userModel.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }
    const isCorrectCurrentPassword = await user.comparePassword(currentPassword);
    if (!isCorrectCurrentPassword) {
        throw new Error(`Current password is incorrect`)
    }
    user.password = newPassword;
    setCache(`user:${userId}`, user, 60 * 60 * 1000);
    await user.save();
    return user;
}

const deleteProfileServices = async (userId) => {
    const deletedUser = await userModel.findByIdAndDelete(userId);
    if (!deletedUser) {
        throw new Error('User not found');
    }
    invalidateCache(`user:${userId}`);
    return { message: 'Profile deleted successfully' };
};
module.exports = { registerServices, loginServices, getProfileServices, updateProfileServices, changePasswordServices, deleteProfileServices }