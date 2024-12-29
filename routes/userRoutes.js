const express = require('express');
const UserController = require('../controllers/userController');
const { verifyToken, verifyHRManager } = require('../middleware');

const router = express.Router();

router.post('/register-user',
    verifyToken,
    (req, res, next) => {
        if (req.user.role === 'Admin') {
            return next();
        }
        return verifyHRManager(req, res, next);
    },
    UserController.registerUser
);
router.post('/create-admin', UserController.createAdmin);
router.post('/login', UserController.login);
router.get('/',
    verifyToken,
    (req, res, next) => {
        if (req.user.role === 'Admin') {
            return next();
        }
        return verifyHRManager(req, res, next); 
    },
    UserController.getAllUsers
);
router.get('/username/:username', verifyToken, UserController.getUserByUsername);
router.get('/by-nif/:nif', verifyToken, UserController.getUserByNIF);
router.get('/by-department/:departmentName',
    verifyToken,
    (req, res, next) => {
        if (req.user.role === 'Admin' || req.user.role === 'Manager') {
            return next();
        }
        return res.status(403).json({ error: 'You do not have the necessary permissions' });
    },
    UserController.getUsersByDepartment
);
router.put('/username/:username', verifyToken, UserController.updateUserByUsername);
router.put('/inactivate/:username',
    verifyToken,
    (req, res, next) => {
        if (req.user.role === 'Admin') {
            return next();
        }
        return verifyHRManager(req, res, next);
    },
    UserController.inactivateUserByUsername
);
router.put('/balance/:nif', verifyToken, UserController.updateBalanceByNIF);
router.get('/balance/:nif', verifyToken, UserController.getBalanceByNIF);
router.post('/:username/change-password', verifyToken, UserController.changePassword);

module.exports = router;
