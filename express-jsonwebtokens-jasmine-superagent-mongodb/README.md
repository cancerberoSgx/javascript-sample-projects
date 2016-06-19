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

##running tests 

(automatically will start a server - make sure isn't one running)

	node node_modules/jasmine/bin/jasmine.js

notice that test1Spec.js requires that mongodb is executed. Command example:

	mkdir /tmp/dbtest1
	mongod --dbpath /tmp/dbtest1


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

