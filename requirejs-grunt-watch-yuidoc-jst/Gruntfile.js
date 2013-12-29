//@author sgurin
module.exports = function(grunt) {

	//variables about source files: 
	
	var jsSrcFiles = 'client/src/**/*.js'; 
	
	var templatesPath = [ 'client/src/ui/template/**/*.html' ]; 
	
	var templateOutput = 'client/build/template-output.js'
	var jstFiles={}; 
	jstFiles[templateOutput]=templatesPath; 
	// var jsSrcAndTemplates = jsSrcFiles.slice(0); //clone
	// var tempaltesOutput = 'client/src/ui/template/output.js'; 
	// jsSrcAndTemplates.push(tempaltesOutput);
// var jsSrcAndTemplates = []
	// Load Grunt tasks declared in the package.json file
	require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	// Project configuration.
	grunt.initConfig({
		pkg : grunt.file.readJSON('package.json')

		,
		jshint : {
			all : jsSrcFiles

			,
			options : {
				"predef" : [ '_', 'console', 'define' ],
				"laxcomma" : true
			}
		}

		,
		requirejs: {
			compile: {
				options: {
					baseUrl: "client",
					name: 'Main',
					mainConfigFile: "client/require-config.js",
					out: "client/build/js-code-editor-optimized.js"
				}
			}
		}

		,
		clean : [ 'build']

		,
		jst : {
			compile : {
				options : {
					processName : function(filename) {
						return filename.substring(filename
								.lastIndexOf('/') + 1, filename
								.lastIndexOf('.html'));
					},
					namespace : 'jsCodeEditor.template'
				},
				files : jstFiles
			}
		}

		,
		yuidoc : {
			compileClient : {
				name : '<%= pkg.name %>'
			,	description : '<%= pkg.description %>'
			,	version : '<%= pkg.version %>'
			,	url : '<%= pkg.homepage %>'
			,	logo: '../logo.png'

			,	options : {
					paths : 'client/src'
//					themedir : 'path/to/custom/theme/',//js-editors/node_modules/grunt-contrib-yuidoc/node_modules/yuidocjs/themes/default
				,	outdir : 'apidoc'
   				,	linkNatives: "true"
				}
			}
		}

		// https://github.com/gruntjs/grunt-contrib-connect
		//run 'grunt run' and a server will be started for easy testing the example (http://localhost:8080/sgxjseditors/test/sgxjseditors.html) or even the apidocs. Thanks to grunt-contrib-watch the templates and apidocs are compiled each time you save a file.  
	,	connect : { 
			server : {
				options : {
					port : 8080
				,	base : '.'
				// ,	keepalive: true
				// ,	open: 'http://localhost:8080/client/index.html'
				}
			}
		}

	,	watch : {
			templates : {
				files : templatesPath,
				tasks : [ 'jst' ]
			}

	,	apidoc : {
				files : jsSrcFiles,
				tasks : [ 'yuidoc' ]
			}
		}
	
	//,	express: {
	 //      default_option: {
	 //      	server: 'server/server2.js'
	 //      ,	base: '.'
	 //      }
	 //    }

	// ,	 express: {
	// 	    options: {
	// 	      // Override defaults here
	// 	    },
	// 	    dev: {
	// 	      options: {
	// 	        script: 'server/server2.js'
	// 	      }
	// 	    }
	// 	}

		// jasmine : {
		// 	customTemplate : {
		// 		src : jsSrcFiles.concat(templatesJsOutput),
		// 		options : {
		// 			vendor : dependencies,
		// 			specs : 'sgxjseditors/spec/*spec.js',
		// 			keepRunner: true
		// 		}
		// 	}
		// }

		});
	

	
	/////TASK DEFINITIONS
	
	grunt.registerTask('default', [ 'clean', 'jshint', 'jst', 'requirejs' ]);
	grunt.registerTask('run', [ 'connect', 'watch' ]);
	// grunt.registerTask('run', [ 'express', 'watch' ]);
	grunt.registerTask('apidoc', [ 'clean', 'yuidoc' ]);

	
	grunt.registerTask('test', [ 'jasmine' ]);
	

};