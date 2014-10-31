// Include gulp
var gulp = require('gulp'); 

// Include Our Plugins
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var source = require('vinyl-source-stream');
var browserify = require('browserify');
var exposify   = require('exposify'); 
var buffer = require('vinyl-buffer'); 

var connect = require('gulp-connect');


// Lint Task
gulp.task('lint', function() {
    return gulp.src('./js/*.js')
      .pipe(jshint())
      .pipe(jshint.reporter('default'));
});

// Compile Our Sass
gulp.task('sass', function() {
    return gulp.src('scss/main.scss')
      .pipe(sass())
      .pipe(gulp.dest('dist'))
      .pipe(connect.reload())
      ;
});

// Concatenate & Minify JS
gulp.task('uglify', function() {
    return gulp.src('dist/src.js')
        .pipe(uglify())
        .pipe(gulp.dest('dist'));
});

// Watch Files For Changes. 
// In linux, if NOENT error, please run: 
// echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
gulp.task('watch', function() {
    gulp.watch('js/*.js', ['lint', 'src', 'uglify']);
    gulp.watch('scss/*.scss', ['sass']);
    gulp.watch('html/*.html', ['html']);
});

gulp.task('connect', function() {
  connect.server({root: './dist', keepalive: false, livereload:true});
});




// configure what we want to expose
exposify.config = { angular: 'angular' };

gulp.task('src', function() {
    return browserify({
      entries: ['./js/index.js']
    })

    .transform(exposify)
    .bundle()

      .pipe(source('src.js'))
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



//copy html(* to dist
gulp.task('html', function(){
  return gulp.src('./html/*.html')
    .pipe(gulp.dest('dist'));
});


//copy /libs to dist
gulp.task('copy', function(){
  return gulp.src('./libs/angular/*.js')
    .pipe(gulp.dest('dist/libs/angular'));
});







// Default Task
gulp.task('default', ['lint', 'sass', 'src', 'copy', 'html']);

gulp.task('run', ['lint', 'sass', 'src', 'copy', 'html', 'connect', 'watch']);