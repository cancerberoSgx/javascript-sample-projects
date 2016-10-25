var request = require('superagent');
var utils = require('./testUtils')
var dbutils = require('../src/db')

describe('setup', function()
{
	var db, dontExists = true;

	it('check if user already exists', function(cb)
	{
		dbutils
		.connect()
		.then(function(db_)
		{
			db = db_;
			return dbutils.searchUser(db, 'sgurin', 'test123');
		})
		.then(function(users)
		{
			if(users && users.length)
			{
				console.log('user already exists')
				return new Promise(function(resolve){resolve(users)}); 
			}
			else
			{
				console.log('user dont exists, creating it now.')
				return dbutils
				.insertUser(db, {name: 'sgurin', password: 'test123'})
				.then(function()
				{
					return dbutils.searchUser(db, 'sgurin', 'test123')
				})
			}
		})
		.then(function(users)
		{
			expect(users && users.length>0).toBe(true);
			db.close()
			cb();
		})
		.catch(function(ex)
		{
			console.log('error', ex)
			db.close()
			cb();
		});
	});

})