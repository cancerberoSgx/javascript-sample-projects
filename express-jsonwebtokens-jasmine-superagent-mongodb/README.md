##Intro

Right now just just a learning-project w node js web application that:

 * implements a REST api using express
 * has authentication using jsonwebtoken
 * stores data using mongodb
 * has unit test of auth, api, etc (using jasmine and superagent). 
 * has mongodb

No client / UI application - just api.

##Install: 

	npm install

##starting the server : 

	node bin/www

##running mongodb server

	mkdir /tmp/dbtest1
	mongod --dbpath /tmp/dbtest1

##running tests 

(automatically will start a server - make sure isn't one running)

	npm test

 * mongodb server must be running. 
 * Make sure the server at (http://localhost:3000) is killed first (killall node)
 * Try to execute the tests twice since in the first time a new user is created. 

##Calling the API

See spec/test1Spec.js - it will turn on the server, ask for a web token, and call the API using that webtoken. An example using superagent

	var myToken
	request
		.post('http://localhost:3000/api/authenticate')
		.send({name: 'johnsnow', password: 'winteris123'})
		.end(function(err, res)
		{
			mytoken = res.body.token;
		});

