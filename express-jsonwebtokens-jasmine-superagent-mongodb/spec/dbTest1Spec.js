var request = require('superagent');
var utils = require('./testUtils')
var dbutils = require('../src/db')
describe('', function()
{
	it('connect callback', function(cb)
	{
		dbutils.connect(function(err, db)
		{
			// console.log(arguments)
			expect(!!err).toBe(false);
			expect(!!db).toBe(true);
			!!db && db.close();
			cb();
		})
	});
	it('connect promise', function(cb)
	{
		dbutils
		.connect()
		.then(function(db)
		{
			// expect(!!err).toBe(false);
			expect(!!db).toBe(true);
			!!db && db.close();
			cb();
		})
		.catch(function(err)
		{
			expect(err).toBe(undefined)
			console.log('DB connection ERROR: ', err);
			cb();
		})
	});


	it('connect insert search', function(cb)
	{
		var db 
		dbutils
		.connect()
		.then(function(db_)
		{
			db = db_
			return dbutils.insertDocument(db);
		})
		.then(function()
		{
			return dbutils.findRestaurants(db);
		})
		.then(function(result)
		{
			expect(result.length>0).toBe(true);
		})


		// .then(function()
		// {
		// 	return dbutils.removeRestaurants(db);
		// })
		// .then(function()
		// {
		// 	return dbutils.findRestaurants(db);
		// })
		// .then(function(result)
		// {
		// 	expect(result.length).toBe(0);
		// })

		// .then(function(db_)
		// {
		// 	db = db_
		// 	return dbutils.insertDocument(db);
		// })

		




		//close data base and catch errors:
		.then(function()
		{
			db.close()
			cb()
		})
		.catch(function(err)
		{
			expect(err).toBe(undefined)
			console.log('DB connection ERROR: ', err); 
			db.close()
			cb();
		})
	});

})