/**
@class PerforceConfigView
@extend BaseView
*/
define('PerforceConfigView', 
	['BaseView', 'FolderDDManager'], 
	function(BaseView, FolderDDManager) {

	var PerforceConfigView = function(){		
		BaseView.apply(this, arguments); 
	}; 
	PerforceConfigView.prototype = new BaseView();
	_.extend(PerforceConfigView.prototype, {
		template: 'PerforceConfig'
	,	events: {
			'submit form': 'formSubmit'
		}
		,	afterRender: function(){
				/**
				@property folderDDManager {FolderDDManager}
				*/
				this.folderDDManager = new FolderDDManager();
				application.folderDDManager.install(this.$('[dropzone]').get()); 
		}
	,	formSubmit: function(e){
			e.stopPropagation();
			e.preventDefault();
			var cmd = this.getPerforceCommand();
			this.application.dataManager.getPerforceChangelists(cmd, function(data){
				this.$('.output1').text('loaded '+data.length+' changelists'); 
				// debugger;
				// console.log('fromPerforceConfigView: '+data); 

			}); 
		}
	,	getPerforceCommand: function(){
			var data = this.$('form').serializeArray(); 
			var dataObj = this.serializeArrayToObject(data); 
			return dataObj; 
		}
	,	serializeArrayToObject: function(a) {
			var o = {}; 
			for (var i = 0; i < a.length; i++) {
				o[a[i].name] = a[i].value; 
			}
			return o; 
		}
	});

	return PerforceConfigView; 
});