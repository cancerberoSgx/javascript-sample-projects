var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var templates = require('./templates');


function setup(app)
{
	app.use(logger('dev'));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(cookieParser());
	// app.use(express.static(path.join(__dirname, 'public')));

	registerIndex(app);
	require('./authentication').registerAuthTools(app, express);

	require('./errors').registerErrorHandlers(app);
}


function registerIndex(app)
{
	var router = express.Router();
	router.get('/', function(req, res, next) 
	{
		res.json({
			success: true,
			message: 'Just testing'
		});
	});
	//TODO. remove - just a test of html templates
	router.get('/test1', function(req, res, next) 
	{
		templates.render('index.html', {message: 'hello world'}, res); 
	});
	app.use('/', router);
}


var app = express();
setup(app);

module.exports = app;
