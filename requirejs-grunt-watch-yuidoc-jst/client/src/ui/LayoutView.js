/**
@class LayoutView
@extend BaseView
*/

define('LayoutView', ['BaseView'], function(BaseView) {	
	var LayoutView = function(){		
		BaseView.apply(this, arguments); 
	}; 
	LayoutView.prototype = _.extend(new BaseView(), {
		template: 'Layout'
	// ,	events: {
	// 		'click [data-nav="leaf"]': 'hideNavBar'
	// 	}
	// ,	hideNavBar: function(e){
	// 		$(e.target).parent('[data-nav="leaf"]')
	// 	}
	});;


	return LayoutView; 
});