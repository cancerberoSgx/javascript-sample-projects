var $ = require('jquery');
var _ = require('underscore'); 
var Backbone = require('backbone'); 

module.exports = {
	doit: function(msg)
	{		

		var model = new Backbone.Model({a: 3.14});

		$('body').append('<br/>this is module1 saysXXXXggg ' + _.escape(msg) + ' - ' + model.get('a')); 

	}
}; 