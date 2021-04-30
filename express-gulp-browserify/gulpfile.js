var gulp = require('gulp')

,	express=require('express')
,	Server = require('./src/server/index')

,	browserify = require('browserify')
,	source = require('vinyl-source-stream')
,	buffer = require('vinyl-buffer')
,	uglify = require('gulp-uglify')
,	sourcemaps = require('gulp-sourcemaps')
,	map = require('map-stream')

,	template = require('gulp-template-compile')
,	concat = require('gulp-concat')

,	watch = require('gulp-watch')

gulp.task('templates', function () 
{
	gulp.src('./src/client/html/**/*.html')
		// .pipe(watch('./src/client/html/**/*.html'))
		.pipe(template())
		.pipe(concat('templates.js'))
		.pipe(gulp.dest('./dist'));
});

gulp.task('server', ['copy', 'templates', 'browserify'], function()
{
	var server = new Server(); 
	server.start(); 
});

gulp.task('copy', function()
{	
	gulp
		.src(['./src/client/static/**/**'])
		.pipe(watch('./src/client/static/**/*'))
		.pipe(gulp.dest('dist'));
});

gulp.task('browserify', function () 
{
	doBrowserify(); 

	gulp
		.src(['./src/client/js/**/*.js'])
		.pipe(watch('./src/client/js/**/*.js'))
		.pipe(map(function (file, cb) //TODO: we are reacting for each file?
		{
			doBrowserify(); 
		}))
		.pipe(gulp.dest('dist'))
});

function doBrowserify()
{	
	// set up the browserify instance on a task basis
	var b = browserify({
		debug: true
	});
	b.require('./src/client/js/index.js', {expose: 'express-gulp-browserify'});
	// b.require('underscore');
	return b.bundle()
		.pipe(source('client.js'))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps: true}))
				// Add transformation tasks to the pipeline here.
				// .pipe(uglify())
				.on('error', console.log)
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'));
}

