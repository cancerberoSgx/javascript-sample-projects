var AbstractView = require('./AbstractView')
,	jQuery = require('../util/jQuery')
,	JSONEditor = require('../util/JSONEditor')

module.exports = AbstractView.extend({

	template: 'JsonEditorView.html'

,	afterRender: function()
	{
		var editor = new JSONEditor(this.$('.jsoneditor-container').get(0));

		// set json
		var json = {
			"Array": [1, 2, 3],
			"Boolean": true,
			"Null": null,
			"Number": 123,
			"Object": {"a": "b", "c": "d"},
			"String": "Hello World"
		};
		editor.set(json);

		// get json
		var json = editor.get();
		
	}
}); 