const { User } = require('../models/userModel');
const DepartmentModel = require('../models/departmentModel');

exports.createDepartment = async (req, res) => {
    console.log("POST: /api/departments - " + JSON.stringify(req.body));

    try {
        const departmentName = req.body.name.trim();

        const existingDepartment = await DepartmentModel.findOne({
            name: { $regex: `^${departmentName}$`, $options: 'i' }
        });

        if (existingDepartment) {
            console.log(`Error: Department with name "${departmentName}" already exists.`);
            return res.status(400).json({ error: "Department name must be unique." });
        }

        const department = new DepartmentModel({
            ...req.body,
            name: departmentName
        });

        const savedDepartment = await department.save();
        console.log(`Success: Department "${savedDepartment.name}" created successfully.`);
        res.status(201).json(savedDepartment);

    } catch (error) {
        console.error("Error creating department:", error);
        res.status(500).json({ error: 'Error creating department', details: error.message });
    }
};

exports.getAllDepartments = async (req, res) => {
    console.log("GET: /api/departments");
    const user = req.user;

    try {
        let departments;

        if (user.role === 'Manager') {
            departments = await DepartmentModel.find({ managerUsername: user.username }).sort({ name: 1 });
            console.log(`Success: Retrieved ${departments.length} departments for Manager.`);
            return res.json(departments);
        }

        if (user.role === 'Admin') {
            departments = await DepartmentModel.find().sort({ name: 1 });
            console.log(`Success: Retrieved ${departments.length} departments for Admin.`);
            return res.json(departments);
        }        

        return res.status(403).json({ error: 'You are not authorized to view departments.' });

    } catch (error) {
        console.error("Error retrieving departments:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getDepartmentByName = async (req, res) => {
    const departmentName = req.params.name.trim().toLowerCase();
    const user = req.user;

    console.log(`GET: /api/departments/${departmentName}`);
    console.log(`User Role: ${user.role}`);

    try {
        const department = await DepartmentModel.findOne({ name: departmentName }).collation({ locale: 'en', strength: 2 });
        if (!department) {
            console.log(`Error: Department with name ${departmentName} not found.`);
            return res.status(404).json({ message: 'Department not found' });
        }

        if (user.role === 'Admin' || (user.role === 'Manager' && department.managerUsername === user.username)) {
            console.log(`Success: Department ${department.name} retrieved successfully.`);
            return res.json(department);
        }

        return res.status(403).json({ error: 'You are not authorized to view this department.' });
    } catch (error) {
        console.error("Error retrieving department:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateDepartment = async (req, res) => {
    const oldDepartmentName = req.params.name.trim().toLowerCase();
    console.log(`PUT: /api/departments/${oldDepartmentName} - ${JSON.stringify(req.body)}`);

    try {
        if (req.body.managerUsername) {
            const managerExists = await User.findOne({ username: req.body.managerUsername });
            if (!managerExists) {
                console.log(`Error: Manager with username ${req.body.managerUsername} not found.`);
                return res.status(400).json({ message: 'Invalid manager username. Please provide a valid username.' });
            }
        }

        const newDepartmentName = req.body.name?.trim().toLowerCase();
        const department = await DepartmentModel.findOneAndUpdate(
            { name: oldDepartmentName },
            req.body,
            { new: true, collation: { locale: 'en', strength: 2 } }
        );

        if (!department) {
            console.log(`Error: Department with name ${oldDepartmentName} not found.`);
            return res.status(404).json({ message: 'Department not found' });
        }

        if (newDepartmentName && newDepartmentName !== oldDepartmentName) {
            await User.updateMany(
                { department: oldDepartmentName },
                { $set: { department: newDepartmentName } }
            );
            console.log(`Associated users' department name updated from ${oldDepartmentName} to ${newDepartmentName}.`);
        }

        console.log(`Success: Department ${department.name} updated successfully.`);
        res.json(department);
    } catch (error) {
        console.error("Error updating department:", error);
        res.status(400).json({ error: error.message });
    }
};

exports.deleteDepartment = async (req, res) => {
    const departmentName = req.params.name.trim().toLowerCase();
    console.log(`DELETE: /api/departments/${departmentName}`);
    
    try {
        const department = await DepartmentModel.findOne({ name: departmentName })
            .collation({ locale: 'en', strength: 2 });

        if (!department) {
            console.log(`Error: Department with name ${departmentName} not found.`);
            return res.status(404).json({ message: 'Department not found' });
        }

        const usersInDepartment = await User.find({ department: department._id });

        if (usersInDepartment.length > 0) {
            console.log(`Error: Department ${department.name} cannot be deleted because it has associated users.`);
            return res.status(400).json({ message: 'Department cannot be deleted while it has associated users.' });
        }

        await DepartmentModel.findOneAndDelete({ name: departmentName }).collation({ locale: 'en', strength: 2 });
        console.log(`Success: Department ${department.name} deleted successfully.`);
        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        console.error(`Error deleting department: ${error}`);
        res.status(500).json({ error: 'Error deleting department', details: error.message });
    }
};

exports.getDepartmentByManagerNIF = async (req, res) => {
    const managerNIF = req.params.nif;
    const user = req.user;
    console.log(`GET: /api/departments/manager/nif/${managerNIF}`);

    try {
        const department = await DepartmentModel.findOne({ managerNIF: managerNIF });

        if (!department) {
            console.log(`Error: Department not found for manager with NIF ${managerNIF}.`);
            return res.status(404).json({ message: 'Department not found for this manager.' });
        }

        if (user.role === 'Admin' || (user.role === 'Manager' && department.managerNIF === user.nif)) {
            console.log(`Success: Department found for manager with NIF ${managerNIF}.`);
            return res.json(department);
        }

        return res.status(403).json({ error: 'You are not authorized to view this department.' });
    } catch (error) {
        console.error("Error retrieving department by manager NIF:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getCanteenDiscountByNIF = async (req, res) => {
    const userNIF = req.user.nif;
    console.log(`GET: /api/departments/canteendiscount/${userNIF}`);

    try {
        const user = await User.findOne({ nif: userNIF });
        if (!user) {
            console.log(`Error: User with NIF ${userNIF} not found.`);
            return res.status(404).json({ message: 'User not found.' });
        }

        const department = await DepartmentModel.findOne({ name: user.department });
        if (!department) {
            console.log(`Error: Department for user with NIF ${userNIF} not found.`);
            return res.status(404).json({ message: 'Department not found.' });
        }

        console.log(`Department found: ${department.name}, Canteen discount: ${department.canteenDiscount}`);

        return res.json({ departmentName: department.name, canteenDiscount: department.canteenDiscount });

    } catch (error) {
        console.error("Error retrieving canteen discount:", error);
        return res.status(500).json({ error: error.message });
    }
};
