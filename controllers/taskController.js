const mongoose = require('mongoose');
const TaskModel = require('../models/taskModel');
const { User } = require('../models/userModel');

exports.createTask = async function(req, res) {
    console.log("POST: /api/tasks");
    const { taskName, description, limit_date, isCompleted, assignedTo } = req.body;
    const user = req.user;

    if (!description || !limit_date) {
        return res.status(400).json({ error: 'Description and limit_date are required.' });
    }

    const limitDate = new Date(limit_date);
    if (isNaN(limitDate.getTime()) || limitDate <= new Date()) {
        return res.status(400).json({ error: 'Limit date must be a valid date in the future.' });
    }

    let assignedUser;
    if (assignedTo) {
        try {
            assignedUser = await User.findOne({ username: assignedTo });
            if (!assignedUser) {
                return res.status(404).json({ error: 'Assigned user not found' });
            }

            if (assignedUser.role === 'Inactive') {
                return res.status(400).json({ error: 'Assigned user is inactive' });
            }
        } catch (err) {
            return res.status(500).json({ error: 'Error finding assigned user', details: err.message });
        }
    }
    
    const newTask = new TaskModel({
        taskName,
        description,
        limit_date: limitDate,
        isCompleted: isCompleted || false,
        assignedTo: assignedUser.username,
        createdBy: user._id
    });

    try {
        const savedTask = await newTask.save();
        console.log("Task created successfully:", savedTask);
        res.status(201).json({ message: 'Task created successfully!', task: savedTask });
    } catch (err) {
        console.error("Error creating task:", err);
        res.status(500).json({ error: 'Error creating task', details: err.message });
    }
};

exports.getAllTasks = async function(req, res) {
    console.log("GET: /api/tasks");
    const user = req.user;

    try {
        let tasks;

        if (user.role === 'Manager') {
            const usersInDepartment = await User.find({ department: user.department }).select('username');
            const usernames = usersInDepartment.map(u => u.username);
            tasks = await TaskModel.find({ assignedTo: { $in: usernames } });
        } else {
            tasks = await TaskModel.find();
        }

        tasks = tasks.map(task => {
            const date = new Date(task.limit_date);
            task.limit_date = date.toISOString().split('T')[0];
            return task;
        });

        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: 'Error retrieving tasks', details: err.message });
    }
};

exports.getTaskById = async function(req, res) {
    const taskId = req.params.id;
    console.log(`GET: /api/tasks/${taskId}`);
    const user = req.user;

    try {
        const task = await TaskModel.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        let assignedUser;
        if (task.assignedTo) {
            assignedUser = await User.findOne({ username: task.assignedTo });
        }

        if (user.role === 'Employee' && task.assignedTo !== user.username) {
            return res.status(403).json({ error: 'This task is not assigned to you.' });
        } else if (user.role === 'Manager' && assignedUser?.department !== user.department) {
            return res.status(403).json({ error: 'You are not authorized to view this task.' });
        }

        task.assignedTo = assignedUser ? assignedUser.username : null;

        res.status(200).json(task);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching task', details: err.message });
    }
};

exports.getTaskByUserUsername = async function(req, res) {
    const username = req.params.username;
    console.log(`GET: /api/tasks/user/${username}`);
    const user = req.user;

    try {
        const userToFind = await User.findOne({ username: username });

        if (!userToFind) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'Employee' && userToFind.username !== user.username) {
            return res.status(403).json({ error: 'You are not authorized to view this user\'s tasks.' });
        } else if (user.role === 'Manager' && userToFind.department !== user.department) {
            return res.status(403).json({ error: 'You are not authorized to view this user\'s tasks.' });
        }

        const tasks = await TaskModel.find({ assignedTo: userToFind.username });
        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching tasks by username', details: err.message });
    }
};

exports.updateTask = async function(req, res) {
    const taskId = req.params.id;
    console.log(`PUT: /api/tasks/${taskId}`);
    const { taskName, description, limit_date, isCompleted } = req.body;
    const user = req.user;

    try {
        const task = await TaskModel.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const assignedUser = await User.findOne({ username: task.assignedTo });

        if (user.role === 'Employee') {
            if (task.assignedTo !== user.username) {
                return res.status(403).json({ error: 'This task is not assigned to you.' });
            }
            if (isCompleted !== undefined) {
                task.isCompleted = isCompleted;
            } else {
                return res.status(403).json({ error: 'Employees can only mark tasks as completed or not.' });
            }
        } else if (user.role === 'Manager' && assignedUser.department !== user.department) {
            return res.status(403).json({ error: 'You are not authorized to edit tasks outside your department.' });
        } else {
            if (taskName) task.taskName = taskName;
            if (description) task.description = description;
            if (limit_date) {
                const newLimitDate = new Date(limit_date);
                if (isNaN(newLimitDate.getTime()) || newLimitDate <= new Date()) {
                    return res.status(400).json({ error: 'Limit date must be a valid date in the future.' });
                }
                task.limit_date = newLimitDate;
            }
            if (isCompleted !== undefined) task.isCompleted = isCompleted;
        }

        await task.save();
        res.status(200).json({ message: 'Task updated!', task });
    } catch (err) {
        res.status(500).json({ error: 'Error updating task', details: err.message });
    }
};
