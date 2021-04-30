
var Backbone = require ( 'backbone' ) ; 

var View1 = Backbone.View.extend ( {
	tagName: "li"
,	className: "view1"
,	events: {
		"click button": "action1"
	,	"click .button.edit": "openEditDialog"
	,	"click .button.delete": "destroy"
	}
,	initialize: function  (  ) {}
,	action1: function  ( e ) {
		e.preventDefault();
		alert('clicked'); 
	}
,	render: function  (  ) {
		this.$el.append('<p>this is the backbone view render2</p>'); 
	}
} ) ; 

module.exports = View1; 