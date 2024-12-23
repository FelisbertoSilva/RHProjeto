const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TaskSchema = new Schema({
    taskName: {
        type: String,
        required: [true, 'Name is required.'],
    },
    description: {
        type: String,
        required: [true, 'Description is required.'],
    },
    limit_date: {
        type: Date,
        required: [true, 'Limit date is required.'],
        validate: {
            validator: function (v) {
                return v > new Date();
            },
            message: props => `${props.value} is not a valid date. Limit date must be in the future.`
        }
    },
    isCompleted: {
        type: Boolean,
        required: true,
        default: false
    },
    assignedTo: {
        type: String,
        required: true,
    }
});

TaskSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Task', TaskSchema);
