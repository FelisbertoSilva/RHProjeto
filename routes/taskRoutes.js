var express = require('express'); 
const TaskController = require('../controllers/taskController');
const { verifyToken, verifyRole } = require('../middleware');

var router = express.Router();

router.get('/due-next-week', verifyToken, TaskController.getTasksDueNextWeek);
router.post('/', verifyToken, verifyRole(['Admin', 'Manager']), TaskController.createTask);
router.get('/', verifyToken, verifyRole(['Admin', 'Manager']), TaskController.getAllTasks);
router.get('/:id', verifyToken, TaskController.getTaskById);
router.get('/username/:username', verifyToken, TaskController.getTaskByUserUsername);
router.put('/:id', verifyToken, TaskController.updateTask);

module.exports = router;