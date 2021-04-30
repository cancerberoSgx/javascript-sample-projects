var isDevel = true; 

var express = require('express');
var fs = require('fs'); 
var cp = require('child_process');
//command line related stuff
var exec = require('child_process').exec;

var _ = require('underscore'); 
// var PerforceCommander = require('./PerforceCommander.js'); 

var app = express();

app.use(express.bodyParser()); 

if(isDevel) { //execute grunt watch for automatic template and yuidoc compilation
	var grunt = cp.spawn('grunt', ['--force', 'watch']); 
	grunt.stdout.on('data', function(data) {
		console.log("%s", data); 
	});
}

// //first of all authenticate the user - the user cannot enter this page if it si not authenticated. 
// app.use(express.basicAuth(function(user, pass, callback) {
// var result = (user === 'sg' && pass === 'test');
// callback(null /* error */, result);
// }));

//then we intercept calls to index and render a template because we need to pass user information to the client. 

var clientFolder = __dirname + '/../client/'; 
var indexTemplate = clientFolder + 'index.underscoreTemplate'; 
var routerPaths = ['', '/', '/index.html', 'index.html', '/contact', '/about']; 

app.use(function(req, res, next){
	// console.log("req.url: "+req.url+', req.method: '+req.method); 
	if(_(routerPaths).contains(req.url)) {
		var context = buildTemplateContext(req, res);
		renderTemplate(indexTemplate, context, function(output){
			res.send(output); 
		});
	}
	else if(req.url.indexOf('/services/perforce')===0 && req.method === 'GET') {
		var perforce = new PerforceCommander();
		perforce.getPerforceChanges('sgurin', 20, null, function(error, changes) {
			res.send(JSON.stringify(changes)); 
		});
	}
	else {
		next();
	}
}); 

function renderTemplate(templFilePath, context, fn) {	
	fs.readFile(templFilePath, 'utf8', function (err,data) {
		if (err) {
			throw err;
		}
		else {
			var templ = _.template(data); 
			var output = templ(context); 
			fn(output); 
		}
	});
}

function buildTemplateContext(req, res) {	
	var context = {isDevel: isDevel}; 
	if(!isDevel) {
		context.user = {username: req.auth.username, password: req.auth.password};
	}
	else {
		context.user = {username: 'some user', password: 'some secret'};
	}
	return context;
}

//last we serve all static files
app.use('/', express.static(clientFolder));


var apidocsFolder = __dirname + '/../apidoc/'; 
app.use('/apidoc/', express.static(apidocsFolder));

module.exports = app;

app.listen(process.env.PORT || 3000);
