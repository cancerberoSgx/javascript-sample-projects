define('Application', ['LayoutView', 'MainRouter', 'DataManager', 'html-templates', 'backbone', 'bootstrap'], 
	function(LayoutView, MainRouter, DataManager) {

	/**
	@class Application
	*/
	var Application=function(){
	}; 

	var proto = Application.prototype;
	/**
	@method start
	@param handler
	*/
	proto.start = function(handler) {
		/**
		@property dataManager {DataManager}
		*/
		this.dataManager = new DataManager();
		/**
		@property mainRouter {MainRouter}
		*/
		this.mainRouter = new MainRouter();
		this.mainRouter.application=this;

		/** the template function global dictionary
		@property template {Object string->function}
		*/
		this.template = jsCodeEditor.template;
		/** the application layout view
		@property layout {LayoutView}
		*/
		this.layout = new LayoutView({application: this});
		this.layout.render(document.body);		

		Backbone.history.start({pushState: true}); 

		this.installAjaxAnim();

		//at last we notify
		if(handler){
			handler.apply(this, arguments); 
		}
	}; 

	proto.installAjaxAnim = function(){
		jQuery(document)
			.ajaxStart(function(){
				jQuery('html').css('cursor', 'wait');
			})
			.ajaxComplete(function(){
				jQuery('html').css({'cursor': 'auto'}); 
			});
	}; 
	return Application;
});
