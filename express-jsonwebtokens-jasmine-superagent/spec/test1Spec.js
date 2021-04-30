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
	
	it('happypath1', function(cb)
	{
		new Promise(function(resolve, reject)
		{
			//first obtain the token
			request
			.post('http://localhost:3000/api/authenticate')
			.send({name: 'sg', password: 'test123'})
			.end(function(err, res)
			{
				err ? reject(err) : resolve(res.body.token);
			})
		})
		.then(function(token)
		{
			//now make the api call passing the token
			return new Promise(function(resolve, reject)
			{
				request
				.get('http://localhost:3000/api/utility1')
				.set('x-access-token', token)
				.end(function(err, res)
				{
					err ? reject(err) : resolve(res.body.result);
				});
			});
		})
		.then(function(result)
		{
			//we have the api call result :)
			// console.log('operation result is: ', result);
			expect(result).toBe(123123)
			cb()
		})
		.catch(function(err)
		{
			console.log('ERROR', err.toString())
			cb()
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