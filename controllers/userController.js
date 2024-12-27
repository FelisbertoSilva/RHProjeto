const jwt = require('jsonwebtoken');
const { User, saveUser, authenticateUser, inactivateUser } = require('../models/userModel');
const DepartmentModel = require('../models/departmentModel');
const { verifyHRManager } = require('../middleware');
const mongoose = require('mongoose');

const registerUser = async (req, res) => {
    const { username, password, name, nif, departmentName, role } = req.body;
    const currentUser = req.user;

    console.log("POST: /api/users/register - " + JSON.stringify(req.body));

    const validRoles = ['Admin', 'Employee', 'Manager'];
    if (!validRoles.includes(role)) {
        console.log("Error: Invalid role.");
        return res.status(400).json({ error: 'Invalid role. Please select from Admin, Employee, or Manager.' });
    }

    try {
        const department = await DepartmentModel.findOne({ name: departmentName });
        if (!department) {
            console.log("Error: Department not found.");
            return res.status(400).json({ error: 'Department not found.' });
        }

        if (currentUser.role === 'Manager' && (role === 'Admin' || role === 'Manager')) {
            console.log("Error: Managers cannot create Admin or Manager users.");
            return res.status(403).json({ error: 'Managers cannot create Admin or Manager users.' });
        }

        const newUser = new User({
            username,
            password,
            name,
            nif,
            department: departmentName,
            role
        });

        const savedUser = await newUser.save();
        console.log("User saved to MongoDB:", savedUser);

        if (role === 'Manager') {
            department.managerUsername = username;
            await department.save();
        }

        console.log("User registered successfully.");
        res.status(201).json({ message: 'User created successfully!', user: savedUser });
    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).json({ error: 'Error saving user', details: err.message });
    }
};

const createAdmin = async (req, res) => {
    const { username, password, name, nif, role } = req.body;

    console.log("POST: /api/users/admin - " + JSON.stringify(req.body));

    if (!password.includes('nibelis')) {
        console.log("Error");
        return res.status(400).json({ error: 'Incorrect Password.' });
    }

    if (role !== 'Admin') {
        console.log("Error: Only Admin can be created via this route.");
        return res.status(400).json({ error: 'Only Admin can be created via this route.' });
    }

    try {
        await saveUser(username, password, name, nif, null, role);

        console.log("Admin created successfully.");
        res.status(201).json({ message: 'Admin user created successfully!' });
    } catch (err) {
        console.error("Error during admin creation:", err);
        res.status(500).json({ error: 'Error saving admin user', details: err.message });
    }
};

const login = async (req, res) => {
    const { username, password } = req.body;

    console.log("POST: /api/users/login - " + JSON.stringify(req.body));

    if (!username || !password) {
        console.log("Error: Missing username or password.");
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const data = await authenticateUser(username, password);
        console.log("Login successful.");
        res.status(200).json({ message: 'Login successful', token: data.token });
    } catch (err) {
        console.error("Error during login:", err.message);
        
        const errorMessage = err.message.includes('User not found') ? 'Invalid username or password' : 'Error logging in';
        
        res.status(400).json({ error: errorMessage, details: err.message });
    }
};

const getAllUsers = async (req, res) => {
    console.log("GET: /api/users");

    try {
        const users = await User.find().populate('department').sort({ name: 1 });
        console.log("Fetched all users.");
        res.status(200).json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: 'Error retrieving users', details: err });
    }
};

const getUserById = async (req, res) => {
    console.log("GET: /api/users/by-id/" + req.params.id);

    try {
        const user = await User.findOne({ _id: req.params.id }).populate('department');
        if (!user) {
            console.log("Error: User not found.");
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.user.role === 'Employee' && req.user._id !== req.params.id) {
            return res.status(403).json({ error: 'Employees can only view their own profile.' });
        }

        if (req.user.role === 'Manager') {
            if (req.user.department.name !== 'Human Resources' && user.department._id.toString() !== req.user.department._id.toString() && req.user._id !== req.params.id) {
                return res.status(403).json({ error: 'Managers can only view employees in their department or themselves.' });
            }
        }

        console.log("User fetched successfully.");
        return res.status(200).json(user);
    } catch (err) {
        console.error("Error fetching user by id:", err);
        res.status(500).json({ error: 'Error retrieving user', details: err });
    }
};

const getUserByUsername = async (req, res) => {
    console.log("GET: /api/users/username/" + req.params.username);

    try {
        const users = await User.find({ username: req.params.username }).populate('department');

        if (req.user.role === 'Employee') {
            const user = users.find(user => user._id.toString() === req.user._id.toString());
            if (!user) {
                console.log("Error: User not found.");
                return res.status(404).json({ message: 'User not found' });
            }
            console.log("User fetched successfully.");
            return res.status(200).json(user);
        }

        if (req.user.role === 'Manager') {
            const filteredUsers = users.filter(user => 
                user._id.toString() === req.user._id.toString() || 
                user.department._id.toString() === req.user.department._id.toString() || 
                req.user.department.name === 'Human Resources'
            );
            console.log("Fetched users by username.");
            return res.status(200).json(filteredUsers);
        }

        if (req.user.role === 'Admin') {
            console.log("Fetched users by username.");
            return res.status(200).json(users);
        }

        return res.status(403).json({ error: 'Access denied' });

    } catch (err) {
        console.error("Error fetching user by username:", err);
        res.status(500).json({ error: 'Error retrieving users', details: err });
    }
};

const getUserByNIF = async (req, res) => {
    console.log("GET: /api/users/nif/" + req.params.nif);

    try {
        const users = await User.find({ nif: req.params.nif }).populate('department');

        if (req.user.role === 'Employee') {
            const user = users.find(user => user._id.toString() === req.user._id.toString());
            if (!user) {
                console.log("Error: User not found.");
                return res.status(404).json({ message: 'User not found' });
            }
            console.log("User fetched by NIF successfully.");
            return res.status(200).json(user);
        }

        if (req.user.role === 'Manager') {
            const filteredUsers = users.filter(user => 
                user._id.toString() === req.user._id.toString() || user.department._id.toString() === req.user.department._id.toString() || req.user.department.name === 'Human Resources'
            );
            console.log("Fetched users by NIF.");
            return res.status(200).json(filteredUsers);
        }

        if (req.user.role === 'Admin') {
            const user = users.find(user => user.nif === req.params.nif);
            if (!user) {
                console.log("Error: User not found.");
                return res.status(404).json({ message: 'User not found' });
            }
            console.log("User fetched by NIF successfully.");
            return res.status(200).json(user);
        }

        return res.status(403).json({ error: 'Access denied' });

    } catch (err) {
        console.error("Error fetching user by NIF:", err);
        res.status(500).json({ error: 'Error retrieving user', details: err });
    }
};

const getUsersByDepartment = async (req, res) => {
    console.log("GET: /api/users/department/" + req.params.departmentName);

    try {
        const department = await DepartmentModel.findOne({ name: req.params.departmentName });
        if (!department) {
            console.log("Error: Department not found.");
            return res.status(404).json({ message: 'Department not found' });
        }

        const departmentId = department._id;

        if (req.user.role === 'Admin') {
            const users = await User.find({ department: departmentId })
                .populate('department')
                .sort({ name: 1 });

            console.log("Fetched users by department successfully.");
            return res.status(200).json(users);
        }

        if (req.user.role === 'Manager') {
            if (req.user.department.name === 'Human Resources' || req.user.department._id.toString() === departmentId.toString()) {
                const users = await User.find({ department: departmentId })
                    .populate('department')
                    .sort({ name: 1 });

                console.log("Fetched users by department successfully.");
                return res.status(200).json(users);
            } else {
                console.log("Error: Managers can only view users in their own department.");
                return res.status(403).json({ error: 'Managers can only view users in their own department.' });
            }
        }

        return res.status(403).json({ error: 'Access denied: You do not have the necessary permissions.' });

    } catch (err) {
        console.error("Error fetching users by department:", err);
        res.status(500).json({ error: 'Error retrieving users', details: err });
    }
};

const updateUserByUsername = async (req, res) => {
    const { name, nif, balance, role, departmentName } = req.body;

    console.log("PUT: /api/users/" + req.params.username + " - " + JSON.stringify(req.body));

    if (role && !['Admin', 'Employee', 'Manager'].includes(role)) {
        console.log("Error: Invalid role.");
        return res.status(400).json({ error: 'Invalid role. Please select from Admin, Employee, or Manager.' });
    }

    try {
        var user = await User.findOne({ username: req.params.username });
        if (!user) {
            console.log("Error: User not found.");
            return res.status(404).json({ message: 'User not found' });
        }

        const isAdmin = req.user.role === 'Admin';
        const isManager = req.user.role === 'Manager';
        const isEmployee = req.user.role === 'Employee';

        if (isEmployee && req.user.username !== user.username) {
            return res.status(403).json({ error: 'Employees can only update their own information.' });
        }

        if (isManager && req.user.department !== 'Human Resources' && req.user.username !== user.username) {
            return res.status(403).json({ error: 'Managers can only update their own information.' });
        }

        if (isAdmin || (isManager && req.user.department === 'Human Resources')) {
            if (isAdmin && user.role === 'Admin' && req.user.username !== user.username) {
                return res.status(403).json({ error: 'Admins cannot update other Admins.' });
            }

            if (isManager && user.role === 'Admin') {
                return res.status(403).json({ error: 'HR Manager cannot update Admin users.' });
            }

            if (role) {
                if (role === 'Admin' && !isAdmin) {
                    return res.status(403).json({ error: 'Only Admins can promote to Admin.' });
                }
                user.role = role;
            }

            if (departmentName) {
                const department = await DepartmentModel.findOne({ name: departmentName });
                if (!department) {
                    console.log("Error: Department not found.");
                    return res.status(400).json({ error: 'Department not found.' });
                }
                user.department = department._id;
            }

            if (name !== undefined && isAdmin) {
                user.name = name;
            }

            if (nif !== undefined && isAdmin) {
                user.nif = nif;
            }
        }

        if (balance !== undefined) {
            const balanceValue = parseFloat(balance);

            if (isNaN(balanceValue) || balanceValue < 0) {
                console.log("Error: Invalid balance value.");
                return res.status(400).json({ error: 'Balance must be a positive number.' });
            }

            if (req.user.username === user.username) {
                user.balance = balanceValue;
            } else if (isAdmin) {
                user.balance = balanceValue;
            } else {
                return res.status(403).json({ error: 'Unauthorized to update balance.' });
            }
        }

        await user.save();
        console.log("User updated successfully.");
        return res.status(200).json({ message: 'User updated successfully!' });
    } catch (err) {
        console.error("Error updating user:", err);
        return res.status(500).json({ error: 'Error updating user', details: err.message });
    }
};

const inactivateUserByUsername = async (req, res) => {
    console.log("PUT: /api/users/inactivate/" + req.params.username);

    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            console.log("Error: User not found.");
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.user.role === 'Admin') { 
            if (user.role === 'Admin') {
                console.log("Error: Admin cannot deactivate another Admin.");
                return res.status(403).json({ error: 'Admin cannot deactivate another Admin.' });
            }
        } else if (req.user.role === 'Manager') { 
            if (user.role !== 'Employee') {
                console.log("Error: Managers can only deactivate Employees.");
                return res.status(403).json({ error: 'Managers can only deactivate Employees.' });
            }
            if (user.department !== req.user.department) {
                console.log("Error: Managers can only deactivate Employees in their own department.");
                return res.status(403).json({ error: 'Managers can only deactivate Employees in their own department.' });
            }
        } else {
            console.log("Error: Access denied.");
            return res.status(403).json({ error: 'Access denied.' });
        }

        user.role = 'Inactive';
        await user.save();
        console.log("User inactivated successfully.");
        res.status(200).json({ message: 'User inactivated successfully!' });

    } catch (err) {
        console.error("Error inactivating user:", err);
        res.status(500).json({ error: 'Error inactivating user', details: err.message });
    }
};

const updateBalanceByNIF = async (req, res) => {
    const { nif } = req.params;
    const { newBalance } = req.body;

    console.log(`PUT: /api/users/balance/${nif} - New Balance: ${newBalance}`);

    if (isNaN(newBalance) || newBalance < 0) {
        return res.status(400).json({ message: 'Invalid balance amount' });
    }

    try {
        const user = await User.findOneAndUpdate(
            { nif },
            { balance: newBalance },
            { new: true }
        );

        if (!user) {
            console.error(`Error: User with NIF ${nif} not found.`);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`Success: Balance updated for user with NIF ${nif}.`);

        res.status(200).json({
            message: 'Balance updated successfully',
            newBalance: user.balance
        });
    } catch (err) {
        console.error(`Error updating balance for user with NIF ${nif}:`, err);
        res.status(500).json({
            error: 'Error updating user balance',
            details: err.message
        });
    }
};

const getBalanceByNIF = async (req, res) => {
    const { nif } = req.params;

    console.log(`GET: /api/users/balance/${nif}`);

    try {
        const user = await User.findOne({ nif });

        if (!user) {
            console.error(`Error: User with NIF ${nif} not found.`);
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'User balance retrieved successfully',
            newBalance: user.balance || 0  
        });
    } catch (err) {
        console.error(`Error retrieving balance for user with NIF ${nif}:`, err);
        res.status(500).json({
            error: 'Error retrieving user balance',
            details: err.message
        });
    }
};

const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    console.log("POST: /api/users/" + req.params.username + "/change-password - " + JSON.stringify(req.body));

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
            error: 'Password must be at least 8 characters long, contain at least one number, and one uppercase letter.'
        });
    }

    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const requesterUsername = req.user.username;
        const isAdmin = req.user.role === 'Admin';
        const isHRManager = req.user.role === 'Manager' && req.user.department === 'Human Resources';

        if (isAdmin && user.role === 'Manager' && user.department === 'Human Resources') {
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE users SET password = ? WHERE username = ?`,
                    [hashedPassword, req.params.username],
                    (err) => {
                        if (err) {
                            reject(new Error('Error updating password in SQLite: ' + err.message));
                        } else {
                            resolve();
                        }
                    }
                );
            });

            console.log("Admin updated HR Manager's password in SQLite.");
            return res.status(200).json({ message: 'HR Manager password updated successfully by Admin.' });
        }

        if (requesterUsername === user.username) {
            const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
            if (!passwordsMatch) {
                return res.status(400).json({ error: 'Current password is incorrect.' });
            }
            
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE users SET password = ? WHERE username = ?`,
                    [hashedPassword, req.params.username],
                    (err) => {
                        if (err) {
                            reject(new Error('Error updating password in SQLite: ' + err.message));
                        } else {
                            resolve();
                        }
                    }
                );
            });

            console.log("Password updated successfully.");
            return res.status(200).json({ message: 'Password updated successfully.' });
        }

        return res.status(403).json({ error: 'You are not authorized to change this password.' });
    } catch (err) {
        console.error("Error changing password:", err);
        return res.status(500).json({ error: 'Error changing password', details: err.message });
    }
};

module.exports = {
    registerUser,
    createAdmin,
    login,
    getAllUsers,
    getUserById,
    getUserByUsername,
    getUserByNIF,
    getUsersByDepartment,
    updateUserByUsername,
    inactivateUserByUsername,
    getBalanceByNIF,
    updateBalanceByNIF,
    changePassword,
};


