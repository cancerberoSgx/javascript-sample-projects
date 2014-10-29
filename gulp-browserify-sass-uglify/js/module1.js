var $ = require('jquery');
var _ = require('underscore'); 

module.exports = {
	doit: function(msg)
	{		
		$('body').append('<br/>this is module1 sayinggggg ' + _.escape(msg)); 
	}
}; 