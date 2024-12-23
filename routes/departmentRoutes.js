const express = require('express');
const departmentController = require('../controllers/departmentController');
const { verifyToken, verifyRole } = require('../middleware');

const router = express.Router();

router.post('/', verifyToken, verifyRole(['Admin']), departmentController.createDepartment);
router.put('/:name', verifyToken, verifyRole(['Admin']), departmentController.updateDepartment);
router.delete('/:name', verifyToken, verifyRole(['Admin']), departmentController.deleteDepartment);
router.get('/', verifyToken, verifyRole(['Admin', 'Manager']), departmentController.getAllDepartments);
router.get('/:name', verifyToken, verifyRole(['Admin', 'Manager']), departmentController.getDepartmentByName);
router.get('/manager/nif/:nif', verifyToken, verifyRole(['Admin', 'Manager']), departmentController.getDepartmentByManagerNIF);
router.get('/canteendiscount/:nif', verifyToken, departmentController.getCanteenDiscountByNIF);

module.exports = router;