var _ = require('underscore')
,	jQuery = require('./util/jQuery')
,	Router = require('./Router')

function Application()
{

}
_(Application.prototype).extend({

	start: function()
	{
		jQuery('body').append(this.getTemplate('_application_layout.html')());
		this.router = new Router(); 
		this.router.application = this; 
		Backbone.history.start({pushState: true}); 
	}

,	getTemplate: function(name)
	{
		return window.JST[name]; 
	}
}); 
module.exports = Application;