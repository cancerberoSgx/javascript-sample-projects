/**
@class BaseModel
@abstract
*/

define('BaseModel', ['backbone'], function() {	
	var BaseModel = function(){		
		Backbone.Model.apply(this, arguments); 
	}; 
	BaseModel.prototype = new Backbone.Model();
	_.extend(BaseModel.prototype, {
	});
	return BaseModel; 
});