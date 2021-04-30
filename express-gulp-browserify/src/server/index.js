var	express=require('express')
,	path = require('path')
,	_ = require('underscore')

var Server = function(config)
{
	this.config = _(_(this.defaultConfig).clone()).extend(config || {});
	this.app = express();
	this.installServices(); 
}; 

_(Server.prototype).extend({

	defaultConfig: {port: 8080}

,	start: function()
	{
		console.log('+- Local http server available at: http://localhost:' + this.config.port + '/');
		this.app.listen(this.config.port, '0.0.0.0');
	}

,	installServices: function()
	{
		var self = this; 
		

		this.app.use('/request', function(req, res, next)
		{
			self.dispatchRequest(req, res, next)
		});

		var distFolder = './dist'
		this.app.use(express.static(distFolder));

		this.app.use('/', function(req, res, next)
		{
			// console.log('ALLLLL: ', req.url, req)
			// res.send('ALLLL', req.url); 
			res.sendFile(path.join(__dirname, 'dist', '../../../dist/index.html'));

		});
	}

,	dispatchRequest: function(req, res, next)
	{
		res.send('dispatchRequest TODO'); 
	}
}); 

module.exports = Server; 

