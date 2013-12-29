module.exports = function (grunt) {
  grunt.initConfig({
    browserify: {
      build: {
        src: ['js/main.js'],
        dest: 'main-browserify.js'
      }
    }

  , watch : {
      browserify : {
        files : 'js/**/*.js',
        tasks : [ 'browserify' ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');

};