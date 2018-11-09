var gulp = require('gulp');
var jasmineBrowser = require('gulp-jasmine-browser');
var webpack = require('webpack-stream');
// var watch = require('gulp-watch');

const webpackModule = {
  rules: [
    {
      test: /\.(png|svg|jpg|gif)$/,
      use: [
        'file-loader'
      ]
    }
  ]
}
gulp.task('jasmine-headless', function () {
  return gulp.src(['dist/**/*Spec.js', 'dist/spec/assets/*'])
    .pipe(webpack({ output: { filename: 'spec.js' }, mode: 'development', module: webpackModule }))
    .pipe(jasmineBrowser.specRunner({ console: true }))
    .pipe(jasmineBrowser.headless({ driver: 'chrome' }))
});

gulp.task('jasmine-server', function () {
  return gulp.src(['dist/**/*Spec.js', 'dist/spec/assets/*'])
    .pipe(webpack({
      watch: true,
      output: { filename: 'spec.js' },
      mode: 'development',
      module: webpackModule
    }
    ))
    .pipe(jasmineBrowser.specRunner())
    .pipe(jasmineBrowser.server());
});