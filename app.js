var cors = require('cors');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
var UserRoutes = require('./routes/userRoutes');
var DepartmentRoutes = require('./routes/departmentRoutes');
var TaskRoutes = require('./routes/taskRoutes');

var app = express();
app.use(cors());
mongoose.set('strictQuery', true);
mongoose.connect('mongodb+srv://User:Password@cluster.hne45.mongodb.net/')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/users', UserRoutes);
app.use('/api/departments', DepartmentRoutes);
app.use('/api/tasks', TaskRoutes);

app.use(function(req, res, next) {
    next(createError(404, "Resource not found"));
});

app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        message: err.message,
        error: req.app.get('env') === 'development' ? err : {}
    });
});

var port = 8080;
app.listen(port, () => {
    console.log("App running on port " + port);
});

module.exports = app;
