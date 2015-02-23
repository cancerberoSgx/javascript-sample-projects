// Include gulp
var gulp = require('gulp'); 

// Include Our Plugins
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var source = require('vinyl-source-stream');
var browserify = require('browserify');
var buffer = require('vinyl-buffer'); 

var connect = require('gulp-connect');


// Lint Task
gulp.task('lint', function() {
    return gulp.src('js/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

// Compile Our Sass
gulp.task('sass', function() {
    return gulp.src('styles/main.scss')
        .pipe(sass())
        .pipe(gulp.dest('dist'));
});

// Concatenate & Minify JS
gulp.task('uglify', function() {
    return gulp.src('dist/all.js')
        .pipe(uglify())
        .pipe(gulp.dest('dist'));
});

// Watch Files For Changes. 
// In linux, if NOENT error, please run: 
// echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
gulp.task('watch', function() {
    gulp.watch('js/*.js', ['lint', 'src', 'uglify']);
    gulp.watch('styles/*.scss', ['sass']);
});


gulp.task('src', function() {
   return browserify({
      entries: ['./js/index.js']
    })
   .require('backbone').require('jquery').require('underscore')
      .bundle()
      .pipe(source('all.js'))
      .pipe(gulp.dest('dist'))
      .pipe(connect.reload())
      ;
});

gulp.task('src-min', ['src'], function() {
   return gulp.src('./dist/all.js')
      .pipe(rename('all.min.js'))
      .pipe(uglify())
      .pipe(gulp.dest('dist'))
      .pipe(connect.reload())
      ;
});


gulp.task('libs', function() {
   return browserify('./js/index-libs.js')
      .bundle()
      .pipe(source('libs.js'))
      .pipe(gulp.dest('dist'))
      ;
});

gulp.task('libs-min', ['libs'], function() {
   return gulp.src('./dist/libs.js')
      .pipe(rename('libs.min.js'))
      .pipe(uglify())
      .pipe(gulp.dest('dist'))
      ;
});


gulp.task('connect', function() {
  connect.server({root: '.', keepalive: false, livereload:true});
});

// Default Task
gulp.task('default', ['lint', 'sass', 'libs', 'src', 'connect', 'watch']);