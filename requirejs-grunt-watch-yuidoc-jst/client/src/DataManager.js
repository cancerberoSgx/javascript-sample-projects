/*jshint evil:true*/

define('DataManager', ['jquery'], function() {
	/**
	@class DataManager 
	*/
	var DataManager = function(){
	}; 
	var proto = DataManager.prototype; 
	/**
	@property serviceUrl {String}
	*/
	proto.perforceServiceUrl = 'services/perforce'; 
	/**
	@method getData
	@param cmd {Object} an object with the following properties (all optionals): file, user, maxResults 
	*/
	proto.getPerforceChangelists = function(cmd, fn) {
		var self = this;
		if(!this.data || forceFlush) {
			jQuery.get(this.perforceServiceUrl, cmd).done(function(data){
				self.data=eval(data);
				console.log('getPerforceChangelists: '+this.data); 
				fn(self.data); 
			}); 
		}
		else {
			fn(self.data); 
		}
	}; 
	return DataManager; 

});
