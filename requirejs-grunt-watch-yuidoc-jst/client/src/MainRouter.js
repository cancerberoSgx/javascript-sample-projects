define('MainRouter', 
	['BaseView', 'PerforceConfigView', 'ListChangelistsView', 'backbone'], 
	function(BaseView, PerforceConfigView, ListChangelistsView) {

	/**
	@class MainRouter
	@extends Backbone.Router
	*/
	var MainRouter=Backbone.Router.extend({

		routes: {
			"about": "about"
		,	"perforce-config": "perforceConfig"
		,	"perforce-listChangelists": "listChangelists"
		}

	,	about: function() {
			this.doRenderTemplate('About'); 
		}

	,	perforceConfig: function(){
			var view = this.getPerforceConfigView();
			view.render('#mainViewContainer');
		}

	,	listChangelists: function(){
			var view = this.getListChangelistView();
			view.render('#mainViewContainer');
		}
		
	,	getPerforceConfigView: function(){
			if(!this.perforceConfigView) {
				this.perforceConfigView = new PerforceConfigView({
					application: this.application
				});
			}
			return this.perforceConfigView; 
		}
	,	getListChangelistView: function(){
			if(!this.listChangelistView) {
				this.listChangelistView = new ListChangelistsView({
					application: this.application
				});
			}
			return this.listChangelistView; 
		}

		//TODO: cache views
	,	doRenderTemplate: function(template) {
			var view = new BaseView({
				template: template
			,	application: this.application
			}); 
			view.render('#mainViewContainer'); 
		}
	});
	return MainRouter;
});
