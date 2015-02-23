require('shelljs/global');

describe('gulp connect', function() 
{
	it('gulp connect should serve index at 8080', function(done) 
	{
		console.log('gulp connect should serve index at 8080'); 
		assertCommandOpenPort({
			cmd: 'gulp connect'
		,	port:8080
		,	timeout:2000
		,	predicate: function(val, msg)
			{ 
				if(!val)
				{
					expect('gulp connect fail: '+msg).toBe(false); 
				}
			}
		,	testBeforeKill: function(done)
			{
				curl({
					host: 'localhost'
				,	port: 8080
				,	path: '/'
				,	dataHandler: function(data, res)
					{
						expect(data.indexOf('</html>') !== -1).toBe(true); 
						done();
					}
				,	errorHandler: function()
					{
						expect('html served').toBe(true); 
						done();
					}
				}); 				
			}
		,	done: done
		}); 
	});		
});


// general utility for testing that a executing a command open a certain port. What it does: 
// 0) assert port is free 1) assert port is unused 2) run the command 3) assert port is used 4) kill the command 5) assert the port is free.
// I promise I tried to write the async part the easier I could....
function assertCommandOpenPort(config)
{
	var port = config.port
	,	predicate = config.predicate
	,	timeout = config.timeout || 2000; 
	isPortTaken(port, function(isUsed)
	{
		predicate(!isUsed, 'step 1 port taken initially'); 
	}); 
	var childProcess = exec(config.cmd, {silent: true, async: true});
	setTimeout(function()
	{
		isPortTaken(port, function(isUsed)
		{
			predicate(isUsed, 'step 2 port not taken'); 
			config.testBeforeKill(function()
			{
				childProcess.kill();
				setTimeout(function() // hack: give some time to the killing
				{
					isPortTaken(port, function(isUsed)
					{
						predicate(!isUsed, 'step 3 port not free');
						config.done();
					});
				}, 50);	
			});
						
		}); 
	}, timeout); // ugly hack: wait until server is up
}

// Utility used by assertCommandOpenPort to know if a port is currently used. Used by assertCommandOpenPort. 
// Usage: isPortTaken(8080, function(isUsed){})
function isPortTaken(port, fn) 
{
	var net = require('net')
	var tester = net.createServer()
	.once('error', function (err) 
	{
		if (err.code != 'EADDRINUSE') 
		{
			return fn(false); 
		}
		fn(true); 	
	})
	.once('listening', function() 
	{
		tester.once('close', function() { fn(false);  })
		.close()
	})
	.listen(port)
}

function curl(config)
{
	var http = require('http');

	var options = {
	    host: config.host
	,   path: config.path || '/'
	,	port: config.port || 80
	}; 
	var request = http.request(options, function (res) 
	{
		var data = '';
		res.on('data', function (chunk) 
		{
			data += chunk;
		});
		res.on('end', function () 
		{
			config.dataHandler && config.dataHandler(data, res);
		});
	});
	request.on('error', function (e) 
	{
		config.errorHandler && config.errorHandler(e);
	});
	request.end();
}
