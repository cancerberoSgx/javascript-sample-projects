var Backbone = require('../util/Backbone')

module.exports = Backbone.View.extend({

	render: function()
	{
		var template = this.application.getTemplate(this.template); 
		var html = template(this); 
		this.$el.append(html); 
		if(this.afterRender)
		{
			this.afterRender.apply(this, arguments); 
		}
	}

}); 