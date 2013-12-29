/*jshint laxcomma:true*/
require.config({
	baseUrl: ''
,	paths: {
		
		//libraries

		'jquery': 'lib/jquery/jquery-2.0.3'
	,	'backbone': 'lib/backbone'
	,	'underscore': 'lib/underscore'
	,	'bootstrap': 'lib/bootstrap/js/bootstrap'
	,	'graphael': 'lib/graphael/graphael-all-min'
	,	'raphael': 'lib/graphael/raphael-min'

		//templates

	,	'html-templates': 'build/template-output'

		//classes 

	,	'Application': 'src/Application'
	,	'FolderDDManager': 'src/util/FolderDDManager'
	,	'Main': 'src/Main'

	,	'BaseView': 'src/ui/BaseView'
	,	'LayoutView': 'src/ui/LayoutView'
	
	,	'MainRouter': 'src/MainRouter'
	,	'DataManager': 'src/DataManager'

	,	'PerforceConfigView': 'src/ui/PerforceConfigView'
	,	'ListChangelistsView': 'src/ui/ListChangelistsView'

	}
,	shim: {
		'backbone': {
			deps: ['underscore','jquery']
		}
	,	'bootstrap': {
			deps: ['jquery']
		}

	// ,	'Main':{deps: ['Application']}
	// ,	'Application': {deps: ['FolderDD']}
	}
});