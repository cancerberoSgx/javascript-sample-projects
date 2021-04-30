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

	it('happypath1', function(cb)
	{
		new Promise(function(resolve, reject)
		{
			//first obtain the token
			request
			.post('http://localhost:3000/api/authenticate')
			.send({name: 'sgurin', password: 'test123'})
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
			expect(result).toBe(123123)
			cb()
		})
		.catch(function(err)
		{
			console.log('ERROR', err.toString())
			cb()
		});

	});


	it('/api/authenticate w good credentials', function(cb)
	{
		request
		.post('http://localhost:3000/api/authenticate')
		.send({name: 'sgurin', password: 'test123'})
		.end(function(err, res)
		{
			expect(!!err).toBe(false);
			expect(res.body.success).toBe(true); 
			expect(res.body.token.length>0).toBe(true); 
			goodToken = res.body.token;
			cb();
		});
	}); 

	it('/api/authenticate w bad credentials', function(cb)
	{
		request
		.post('http://localhost:3000/api/authenticate')
		.send({name: 'sgurin', password: 'wrongnumber'})
		.end(function(err, res)
		{
			expect(res.body.success).toBe(false); 
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

	it('/api/utility1 w bad token', function(cb)
	{
		request
		.get('http://localhost:3000/api/utility1')
		.set('x-access-token', 'inventedtoken')
		.end(function(err, res)
		{
			expect(!!err).toBe(false)
			expect(res.body.success).toBe(false);
			cb();
		});
	}); 




// it('som', function()
// {
// 	console.log('seba')
// 	expect(true).toBe(true)
// })


var co = require('co')
it('happy path using co', function(cb)
{
	co(function*() 
	{
		var token = yield new Promise(function(resolve, reject)
		{
			request
				.post('http://localhost:3000/api/authenticate')
				.send({name: 'sgurin', password: 'test123'})
				.end(function(err, res)
				{
					err ? reject(err) : resolve(res.body.token);
				})
		});

		console.log('token obtained', token);

		var result = yield new Promise(function(resolve, reject)
		{
			request
			.get('http://localhost:3000/api/utility1')
			.set('x-access-token', token)
			.end(function(err, res)
			{
				err ? reject(err) : resolve(res.body.result);
			});
		});

		// var result = yield request
		// 	.get('http://localhost:3000/api/utility1')
		// 	.set('x-access-token', token)
		// 	.end(function(err, res)
		// 	{
		// 		// err ? reject(err) : resolve(res.body.result);
		// 	});

		// console.log('result obtained', result);

		expect(result).toBe(123123)

		cb();
	})
	.catch(function(err) 
	{
		expect(err).toBe(undefined); 
		console.log(err.stack);
	});

})
	




	it('server stop', function(cb)
	{
		utils.serverStop('http://localhost:3000', expect, server, function(error)
		{
			expect(!!error).toBe(false); 
			cb(); 
		});
	});
})



