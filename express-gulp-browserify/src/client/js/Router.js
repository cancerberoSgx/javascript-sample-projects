var Backbone = require('./util/Backbone')
,	JsonEditorView = require('./view/JsonEditorView')
,	jQuery = require('./util/jQuery')

module.exports = Backbone.Router.extend({

	routes: {
		test: 'test'
	}

,	test: function()
	{
		var view = new JsonEditorView(); 
		view.application = this.application; 
		view.$el = jQuery('.app-main-view'); 
		view.render();
	}

,	renderView: function()
	{

	}
}); 