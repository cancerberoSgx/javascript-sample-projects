var isDevel = true; 

var express = require('express');

var app = express();

app.use(express.bodyParser()); 

var clientFolder = __dirname ; //+ '/../client/'; 

//last we serve all static files
app.use('/', express.static(clientFolder));


module.exports = app;

app.listen(process.env.PORT || 3000);
