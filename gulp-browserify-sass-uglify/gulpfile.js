// Include gulp
var gulp = require('gulp'); 

// Include Our Plugins
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

// Lint Task
gulp.task('lint', function() {
    return gulp.src('js/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

// Compile Our Sass
gulp.task('sass', function() {
    return gulp.src('scss/*.scss')
        .pipe(sass())
        .pipe(gulp.dest('css'));
});

// Concatenate & Minify JS
gulp.task('uglify', function() {
    return gulp.src('dist/all.js')
        // .pipe(concat('all.js'))
        // .pipe(gulp.dest('dist'))
        .pipe(uglify())
        .pipe(gulp.dest('dist'));
});

// Watch Files For Changes
gulp.task('watch', function() {
    gulp.watch('js/*.js', ['lint', 'browserify', 'uglify']);
    gulp.watch('styles/*.scss', ['sass']);
});


var source = require('vinyl-source-stream');
var browserify = require('browserify');
var buffer = require('vinyl-buffer')


gulp.task('scripts', function() {
   return browserify('./js/index.js')
      .bundle()
      .pipe(source('all.js'))
      .pipe(gulp.dest('dist'));
});

gulp.task('scripts-min', ['scripts'], function() {
   return gulp.src('./dist/all.js')
      .pipe(rename('all..min.js'))
      .pipe(uglify())
      .pipe(gulp.dest('dist'));
});


// Default Task
gulp.task('default', ['lint', 'sass', 'scripts']);