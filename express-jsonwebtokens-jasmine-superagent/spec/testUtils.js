var request = require('superagent');

module.exports = {

	serverStartup: function(url, expect, cb)
	{
		//make sure is turned off
		request.get(url).end(function(err, res)
		{
			expect(res).toBe(undefined); 
			expect(err.toString().indexOf('ECONNREFUSED')!==-1).toBe(true)
		}); 

		var spawn = require('child_process').spawn;
		var server = spawn('node', ['bin/www']);

		//turn it on
		setTimeout(function()
		{
			request.get(url).end(function(err, res)
			{
				expect(!!err).toBe(false);
				cb(null, server)
				// fn(server)
			})
		}, 500); 
	}

,	serverStop: function(url, expect, server, cb)
	{
		server.kill(); 
		setTimeout(function()
		{
			request.get(url).end(function(err, res)
			{
				expect(res).toBe(undefined); 
				expect(err.toString().indexOf('ECONNREFUSED')!==-1).toBe(true); 
				cb(null); 
			}); 
		}, 500)
	}
}