// examples from https://docs.mongodb.com/getting-started/node/client/
// this file is a very primitive model class - see spec/dbTest1Spec.js on how to use it

var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var assert = require('assert')


var searchUser = function(db, name, password, callback)
{
	return new Promise(function(resolve, reject)
	{
		var cursor = db.collection('users').find({name: name, password: password});
		var docs = []
		cursor.each(function(err, doc) 
		{
			assert.equal(err, null);
			if(err)
			{	
				callback && callback(err)
				reject(err)
			}
			if (doc != null)
			{
				docs.push(doc);
			} 
			else 
			{
				callback && callback(null, docs);
				resolve(docs);    
			}
		});
	});
}

var insertUser = function(db, user, callback)
{
	return new Promise(function(resolve, reject)
	{
		db.collection('users').insertOne( user, function(err, result) 
		{
		    assert.equal(err, null);
		    err ? reject(err) : resolve()
		    callback && callback(err);
		});
	})
}

var insertDocument = function(db, callback) {
	return new Promise(function(resolve, reject)
	{
		db.collection('restaurants').insertOne( {
			"address" : {
			 "street" : "2 Avenue",
			 "zipcode" : "10075",
			 "building" : "1480",
			 "coord" : [ -73.9557413, 40.7720266 ]
			},
			"borough" : "Manhattan",
			"cuisine" : "Italian",
			"grades" : [
			 {
			    "date" : new Date("2014-10-01T00:00:00Z"),
			    "grade" : "A",
			    "score" : 11
			 },
			 {
			    "date" : new Date("2014-01-16T00:00:00Z"),
			    "grade" : "B",
			    "score" : 17
			 }
			],
			"name" : "Vella",
			"restaurant_id" : "41704620"
		    }, function(err, result) {
		    assert.equal(err, null);
		    err ? reject(err) : resolve()
		    callback && callback(err);
		});
	});  
};


var findRestaurants = function(db, callback) 
{
	return new Promise(function(resolve, reject)
	{
		var cursor = db.collection('restaurants').find( );
		var docs = []
		cursor.each(function(err, doc) 
		{
			assert.equal(err, null);
			if(err)
			{	
				callback && callback(err)
				reject(err)
			}
			if (doc != null) {
				// console.dir(doc);
				docs.push(doc);
			} 
			else 
			{
				callback && callback(null, docs);
				resolve(docs);    
			}
		});
	});
};

var removeRestaurants = function(db, callback) 
{
	return new Promise(function(resolve, reject)
	{
	    db.collection('restaurants').deleteMany(
			{ "borough": "Manhattan" },
			function(err, results) 
			{
				err ? reject(err) : resolve(results); 
				// console.log(results);
				callback && callback(err, results);
			}
	    );
	})
};

module.exports = {
	url: 'mongodb://localhost:27017/test'
,	insertDocument: insertDocument
,	findRestaurants: findRestaurants
,	removeRestaurants: removeRestaurants
,	searchUser: searchUser
,	insertUser: insertUser
,	connect: function(callback)
	{
		var self = this;
		return new Promise(function(resolve, reject)
		{
			MongoClient.connect(self.url, function(err, db) 
			{
				callback ? callback(err, db) : null;
				err ? reject(err) : resolve(db)
			});
		});
	}
};
