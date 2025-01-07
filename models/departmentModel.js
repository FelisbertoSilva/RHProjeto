const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const departmentSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        unique: true,
        validate: {
            validator: async function(v) {
                const existingDepartment = await mongoose.models.Department.findOne({
                    name: { $regex: `^${v}$`, $options: 'i' }
                });
                return !existingDepartment;
            },
            message: 'Department name must be unique.',
        },
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
            message: 'Canteen discount must be an integer percentage.',
        },
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
            message: props => `User with username ${props.value} does not exist.`,
        },
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
            message: props => `User with username ${props.value} does not exist.`,
        },
    }],
});

departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Department', departmentSchema);
