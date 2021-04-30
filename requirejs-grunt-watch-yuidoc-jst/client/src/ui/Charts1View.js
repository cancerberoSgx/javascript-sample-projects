/**
@class Charts1View
@extend BaseView
*/
define('Charts1View', ['BaseView'], function(BaseView) {
	var Charts1View = function(){		
		BaseView.apply(this, arguments); 
	}; 
	Charts1View.prototype = new BaseView();
	_.extend(Charts1View.prototype, {
		template: 'Charts1'
	});

	return Charts1View; 
});