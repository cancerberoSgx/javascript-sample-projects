// templates manager
var _ = require('underscore')
, fs = require('fs')
, path = require('path')

var manager = {

	templates: {}

,	getTemplate: function(templateName)
	{
	  // if(!this.templates[templateName])
	  // {

	    var contents = fs.readFileSync(path.join(__dirname, templateName)).toString(); 
	    if(!contents)
	    {
	      console.log('template not found', templateName);
	      return;
	    }
	    this.templates[templateName] = _.template(contents);

	  // }
	  return this.templates[templateName]; 
	}

,	render: function (templateName, context, res)
	{
	  var text = this.getTemplate(templateName)(context); 
	  res.set('Content-Type', 'text/html');//TODO: parametrize 'html'
	  res.send(new Buffer(text));
	  
    	console.log('template rendered: ', templateName, context) ; 
	}
};

module.exports = manager;
