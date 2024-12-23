const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const departmentSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        unique: true,
        index: true,
        set: v => v.trim().toLowerCase(),
        validate: {
            validator: function(v) {
                return /^[A-Za-z\s-]+$/.test(v);
            },
            message: 'Department name must contain only letters, spaces, and hyphens.'
        }
    },  
    canteenDiscount: { 
        type: Number, 
        required: true, 
        min: 0, 
        max: 100, 
        validate: {
            validator: function(v) {
                return v % 1 === 0;
            },
            message: 'Canteen discount must be an integer percentage.'
        }
    },
    managerUsername: {
        type: String, 
        default: '',
        validate: {
            validator: async function(v) {
                if (!v) return true;
                try {
                    const user = await mongoose.model('User').findOne({ username: v });
                    return user !== null; 
                } catch (err) {
                    return false;
                }
            },
            message: props => `User with username ${props.value} does not exist.`
        }
    },
    employees: [{ 
        type: String, 
        default: [],
        validate: {
            validator: async function(v) {
                try {
                    const user = await mongoose.model('User').findOne({ username: v });
                    return user !== null;
                } catch (err) {
                    return false;
                }
            },
            message: props => `User with username ${props.value} does not exist.`
        }
    }]
});

departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Department', departmentSchema);