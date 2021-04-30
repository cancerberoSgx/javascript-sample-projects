define('FileModelSpec', ['FileModel', 'jasmine'], function(BaseModel) {	
	var FileModel = function(){		
		BaseModel.apply(this, arguments); 
	}; 
	FileModel.prototype = new BaseModel();
	_.extend(FileModel.prototype, {
	});
	return FileModel; 
});