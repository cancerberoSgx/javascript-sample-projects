 /**
 the native Backbone.View, see backbonejs.org
 @class Backbone.View  
 */
 /**
 render() for rendering the tempalte indicated by this.template property
 @class BaseView
 @extend Backbone.View 
 */
define('BaseView', ['backbone'], function() {	
	var BaseView = function(){
		Backbone.View.apply(this, arguments);
		var self = this;
		if(arguments.length>0 &&  _(arguments[0]).isObject()) {
			_(arguments[0]).each(function(val, key){
				self[key] = val; 
			}); 
		} 
	}; 
	BaseView.prototype = new Backbone.View();
	_.extend(BaseView.prototype, {
		/**
		implicit reference to the mother application. the instantiator is responsible of assigning ones
		@property application {Application}
		*/
		/**
		@method render
		@param parent {jQuery} optional parent, it will be emptied
		*/
		render: function (parent) {
			if(parent) {
				this.$el = jQuery(parent); 
				this.el=this.$el.get(); 
			}
			// debugger;
			// this.undelegateEvents();
			this.renderTemplate(this.template, this, this.$el); 
			// 
			this.renderDataTemplates();
			this.fixNavigationLinks();
			// debugger;
			this.delegateEvents();

			/**
			subclasses may have a method afterRender that will be called for performing subclass specific task that need to be executed fter the view is rendered. 
			@method afterRender
			*/
			if(_(this.afterRender).isFunction()) {
				this.afterRender();
			}

			return this;
		}
		/**
		@method renderTemplate
		@param context optional
		*/
	,	renderTemplate: function(templateName, view, targetEl, context) {		
			context = _.extend(context || {}, {view: view});
			// debugger;
			var tmpl = this.application.template[templateName](context);
			jQuery(targetEl).html(tmpl);
			// this.$el.html(tmpl);
		}
		/**
		@method renderDataTemplates
		*/
	,	renderDataTemplates: function(){
			var self = this;
			this.$el.find('[data-template]').each(function(){
				var templateName = jQuery(this).data('template');
				if(self.application.template[templateName]) {
					self.renderTemplate(templateName, self, jQuery(this)); 
				}//TODO: log template not found?
			}); 
		}
		/**
		Fix all the anchors so when clicked they trigger Backbone.history.navigate(). 
		Idea taken from https://github.com/backbone-boilerplate/backbone-boilerplate/issues/109
		@method fixNavigationLinks
		*/
	,	fixNavigationLinks: function() {
			// All navigation that is relative should be passed through the navigate
			// method, to be processed by the router. If the link has a `data-bypass`
			// attribute, bypass the delegation completely.
			var domainRoot = (document.location.protocol + "//" + document.location.host);
			$(document).on("click", "a:not([data-bypass])", function(event) {
				
				// Get the *absolute* href from the anchor (not the attribute value)
				var href = $(this).prop("href");

				// Make sure we do have a link and that this link is located within 
				// our Backbone application.
				if(href && href.indexOf(domainRoot) === 0) {
					// Stop the default event to ensure the link will not cause a page refresh.
					event.preventDefault();

					// Get the path, relative to the application root. `Backbone.history.navigate`
					// will work with the full url, however, `Backbone.history.loadUrl`, which is 
					// called by `navigate`, will not.
					var fragment = href.slice(domainRoot.length);

					// `Backbone.history.navigate` is sufficient for all Routers and will
					// trigger the correct events. The Router's internal `navigate` method
					// calls this anyway. `root` is required since we stripped out the `root`
					// when we created the `fragment `.
					Backbone.history.navigate(fragment, {"trigger": true});
				}
			});

		}
	});
	return BaseView;

});