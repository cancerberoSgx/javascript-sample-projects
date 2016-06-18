var request = require('superagent');
var utils = require('./testUtils')
describe('', function()
{
	var server; 

	it('server startup', function(cb)
	{
		utils.serverStartup('http://localhost:3000', expect, function(error, server_)
		{
			server = server_;
			expect(!!error).toBe(false); 
			cb(); 
		})
	}); 

	it('/api/authenticate w no credentials', function(cb)
	{
		request
		.post('http://localhost:3000/api/authenticate')
		.end(function(err, res)
		{
			expect(!!err).toBe(false);
			expect(res.body.success).toBe(false); //bad credentials
			cb();
		});
	}); 

	var goodToken;
	it('/api/authenticate w good credentials', function(cb)
	{
		request
		.post('http://localhost:3000/api/authenticate')
		.send({name: 'sg', password: 'test123'})
		.end(function(err, res)
		{
			expect(!!err).toBe(false);
			expect(res.body.success).toBe(true); 
			expect(res.body.token.length>0).toBe(true); 
			goodToken = res.body.token;
			cb();
		});
	}); 

	it('/api/utility1 w no token', function(cb)
	{
		request
		.get('http://localhost:3000/api/utility1')
		.end(function(err, res)
		{
			expect(res.body.success).toBe(false);
			cb();
		});
	}); 

	it('/api/utility1 w good token', function(cb)
	{
		request
		.get('http://localhost:3000/api/utility1')
		.set('x-access-token', goodToken)
		.end(function(err, res)
		{
			expect(res.body.success).toBe(true); 
			expect(res.body.result).toBeDefined()
			cb();
		});
	}); 

	it('server stop', function(cb)
	{
		utils.serverStop('http://localhost:3000', expect, server, function(error)
		{
			expect(!!error).toBe(false); 
			cb(); 
		});
	});
})