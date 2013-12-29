/**
@class FileModel
*/
/**
@attribute name {String}
*/
/**
@attribute size {int}
*/
define('FileModel', ['BaseModel'], function(BaseModel) {	
	var FileModel = function(){		
		BaseModel.apply(this, arguments); 
	}; 
	FileModel.prototype = new BaseModel();
	_.extend(FileModel.prototype, {
	});
	return FileModel; 
});