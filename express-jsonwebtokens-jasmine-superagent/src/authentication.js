// authentication : 
// https://scotch.io/tutorials/authenticate-a-node-js-api-with-json-web-tokens

var jwt = require('jsonwebtoken');

function registerAuthTools(app, express)
{
	// get an instance of the router for api routes
	var apiRoutes = express.Router(); 

	// route to authenticate a user (POST http://localhost:8080/api/authenticate)
	apiRoutes.post('/authenticate', function(req, res) 
	{
		if( !req.body.name || !req.body.password || req.body.name!=='sg' || req.body.password!=='test123')
		{
			res.json({ success: false, message: 'Authentication failed. User not found.' })
		}
		else
		{
			var payload = {}
			payload[req.body.name] = req.body.password; 
			var token = jwt.sign(payload, 'superSecret');
			// return the information including token as JSON
			res.json({
				success: true,
				message: 'Enjoy your token!',
				token: token
			});
		}
	});

	// route middleware to verify a token
	apiRoutes.use(function(req, res, next) 
	{
		// check header or url parameters or post parameters for token
		var token = req.body.token || req.query.token || req.headers['x-access-token'];

		// decode token
		if (token) 
		{
			// verifies secret and checks exp
			jwt.verify(token, 'superSecret', function(err, decoded) 
			{      
				if (err) 
				{
					return res.json({ success: false, message: 'Failed to authenticate token.' });    
				} 
				else 
				{
					// if everything is good, save to request for use in other routes
					req.decoded = decoded;    
					next();
				}
			});
		} 
		else 
		{
			// if there is no token - return an error
			return res.status(403).send({ 
				success: false, 
				message: 'No token provided.' 
			});      
		}
	});

	apiRoutes.get('/utility1', function(req, res) 
	{
		res.json({
			success: true,
			result: 123123
		});
	});

	// apply the routes to our application with the prefix /api
	app.use('/api', apiRoutes);

}

module.exports = {
	registerAuthTools: registerAuthTools
}

