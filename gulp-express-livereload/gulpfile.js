var gulp = require('gulp'); 
var express = require('express'); 
var livereload = require('gulp-livereload'); 

gulp.task('server', function() 
{

	var express = require('express'); 

	var app = express();
	
	app.use(express.static('.'));

	app.listen('8080');

});


gulp.task('watch', ['server'], function() {
  var server = livereload();
  gulp.watch('./**').on('change', function(file) {
      server.changed(file.path);
  });
});


gulp.task('default', ['watch']);