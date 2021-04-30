// Include gulp
var gulp = require('gulp'); 

// Include Our Plugins
var jshint = require('gulp-jshint');
var sass = require('gulp-sass'); 

var concat = require('gulp-concat');
var connect = require('gulp-connect');

var JS_FILES = './src/**/*.js'; 
var HTML_FILES = './src/**/*.html'; 
var SCSS_FILES = './src/**/*.scss'; 
var DATA_FILES = './data/*.json'; 

gulp.task('lint', function() {
    return gulp.src(JS_FILES)
      .pipe(jshint())
      .pipe(jshint.reporter('default'));
});

gulp.task('sass', function() {
    return gulp.src('./src/main.scss')
      .pipe(sass())
      .pipe(gulp.dest('dist'))
      .pipe(connect.reload())
      ;
});

gulp.task('src', function() {
  return gulp.src(['./src/source-header.js'].concat(JS_FILES))
    .pipe(concat('all.js'))
    .pipe(gulp.dest('dist'))
    .pipe(connect.reload());
});

gulp.task('html', function() {
  return gulp.src(HTML_FILES)
    .pipe(connect.reload());
});
gulp.task('data', function() {
  return gulp.src(DATA_FILES)
    .pipe(connect.reload());
});


// Watch Files For Changes. 
// In linux, if NOENT error, please run: 
// echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
gulp.task('watch', function() {
    gulp.watch(JS_FILES, ['lint', 'src']);
    gulp.watch(HTML_FILES, ['html']);
    gulp.watch(SCSS_FILES, ['sass']);
    gulp.watch(DATA_FILES, ['data']);
});

gulp.task('connect', function() {
  connect.server({root: '.', keepalive: false, livereload:true});
});


gulp.task('default', ['lint', 'sass', 'src']);

gulp.task('run', ['lint', 'sass', 'src', 'connect', 'watch']);

