/**
@class LayoutView
*/

define('ListChangelistsView', ['BaseView'], function(BaseView) {
	var ListChangelistsView = function(){		
		BaseView.apply(this, arguments); 
	}; 
	ListChangelistsView.prototype = new BaseView();
	_.extend(ListChangelistsView.prototype, {
		template: 'ListChangelists'
	,	events: {
			'change [data-action="orderby"]': 'orderBy'
		}
	,	orderBy: function(e){
			var selection = jQuery(e.target).find(':selected').attr('name'); 
			
		}
	});
	return ListChangelistsView; 
});