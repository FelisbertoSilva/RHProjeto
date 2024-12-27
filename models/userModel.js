const mongoose = require('mongoose');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const keyFile = require('../secret.key');
const Department = require('../models/departmentModel');
const Task = require('../models/taskModel');
const db = new sqlite3.Database('HRdatabase.db');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    username: {
        type: String,
        unique: true,
        required: true,
    },
    name: {
        type: String,
        required: true,
        validate: {
            validator: (name) => /^[a-zA-Z\s-]*$/.test(name),
            message: 'Name must contain only letters, spaces, and hyphens.',
        },
    },
    nif: {
        type: String,
        unique: true,
        required: true,
        validate: {
            validator: function (nif) {
                const max = 9;
                if (!/^[0-9]+$/.test(nif) || nif.length !== max) return false;
                let checkSum = 0;
                for (let i = 0; i < max - 1; i++) {
                    checkSum += (nif.charAt(i) - '0') * (max - i);
                }
                let checkDigit = 11 - (checkSum % 11);
                if (checkDigit > 9) checkDigit = 0;
                return checkDigit === (nif.charAt(max - 1) - '0');
            },
            message: 'Invalid NIF number.',
        },
    },
    department: {
        type: String,
        required: function () {
            return this.role !== 'Admin';
        },
    },
    balance: {
        type: Number,
        default: 0.0,
    },
    role: {
        type: String,
        enum: ['Admin', 'Manager', 'Employee', 'Inactive'],
        required: true,
    },
}, { collection: 'users' });

const User = mongoose.model('User', UserSchema);

const saveUser = async (username, password, name, nif, departmentName, role) => {
    if (role === 'Inactive') {
        throw new Error('Cannot create a user with the Inactive role');
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
        throw new Error('Password must be at least 8 characters long, contain at least one number, and one uppercase letter.');
    }

    const user = new User({
        username,
        name,
        nif,
        department: role === 'Admin' ? undefined : departmentName,
        role,
    });

    try {
        await user.validate();
    } catch (err) {
        throw new Error(`Validation failed: ${err.message}`);
    }

    const usernameExists = await new Promise((resolve, reject) => {
        db.get(`SELECT username FROM users WHERE username = ?`, [username], (err, row) => {
            if (err) {
                reject(new Error('SQLite query error: ' + err.message));
            } else {
                resolve(!!row);
            }
        });
    });

    if (usernameExists) {
        throw new Error('Duplicate username. Please use a unique username.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (username, password) VALUES (?, ?)`,
                [username, hashedPassword],
                (err) => {
                    if (err) {
                        reject(new Error('SQLite save error: ' + err.message));
                    } else {
                        resolve();
                    }
                }
            );
        });

        await user.save();
    } catch (err) {
        throw new Error(`Error saving user: ${err.message}`);
    }
    return user;
};

const authenticateUser = async (username, password) => {
    const userRow = await new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM users WHERE username = ?`,
            [username],
            (err, row) => {
                if (err) {
                    reject(new Error('SQLite query error: ' + err.message));
                } else {
                    resolve(row);
                }
            }
        );
    });

    if (!userRow) {
        throw new Error('Invalid credentials');
    }

    const passwordsMatch = await bcrypt.compare(password, userRow.password);
    if (!passwordsMatch) {
        throw new Error('Invalid credentials');
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
        throw new Error('Password must be at least 8 characters long, contain at least one number, and one uppercase letter.');
    }

    const user = await User.findOne({ username });
    if (!user) {
        throw new Error('User not found in MongoDB');
    }

    if (user.role === 'Inactive') {
        throw new Error('User is inactive and cannot log in');
    }

    const token = jwt.sign(
        {
            username: user.username,
            role: user.role,
            id: user._id,
            name: user.name,
            nif: user.nif,
            department: user.department,
            balance: user.balance,
        },
        keyFile.securekey,
        { expiresIn: '1h' }
    );

    return { token };
};

const inactivateUser = async (userId, currentUserId, currentUserRole) => {
    if (currentUserRole !== 'Admin') {
        throw new Error('Only Admins can inactivate users');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    const activeTasks = await Task.find({ userId, status: 'active' });
    if (activeTasks.length > 0) {
        throw new Error('User cannot be inactivated because they have active tasks.');
    }

    user.role = 'Inactive';
    await user.save();
    return `User ${user.username} inactivated successfully`;
};

module.exports = { User, saveUser, authenticateUser, inactivateUser };
