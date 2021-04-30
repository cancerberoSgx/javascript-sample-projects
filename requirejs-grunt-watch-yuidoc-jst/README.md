JavaScript sample project using backbone bootstrap requirejs grunt watch connect yuidoc jst (compiled underscore templates)
=============

Key technologies:

backbone bootstrap requirejs grunt watch connect yuidoc jst (compiled underscore templates) guard guard-livereload livereload

Personally I'm now more fan of browserify than requirejs but they both are nice technologies and this is working nicely...

# Installation

    npm install

This project support two ways of running it. The first using grunt-contrib-connect, nice for development

    $ grunt run
    $ firefox http://localhost:8080/client/index.html

The other one using the little server.js that will output the initial html from a underscore serverside template and if isDevel==true supports grunt watch for automatic file compilation, this is apidocs, underscore templates: 

    $ node server/server2.js
    $ firefox localhost:3000

Also if you would like to run this code in production you would do the following: 

* edit server.js first line and set devel=false
* run "grunt"
* run "node server.js"

This will make the server to serve optimized single javascript files.

# Livereload 
This project supports livereload so the browser is automatically reloaded each time a .js or .css file is changed on the client folder. 

For installing guard and livereload you must:

 -  install ruby
 -  $ gem install guard
 -  $ gem install guard-livereload
 - install livereload extension for your favourite browser : download links: http://feedback.livereload.com/knowledgebase/articles/86242-how-do-i-install-and-use-the-browser-extensions-   basic site: http://livereload.com/

For doing the livereloading thing you need to : 

    $ cd client
    $ guard

open the server in a new terminal and voilá.

# API Documentation

grunt-contrib-yuidoc is used for source code API documentation in the form of jsdoc comments. When you run the servers (grunt run or node server/server2.js) sources are watched and when you change them, the API docs will be updated. For example:

    $ node server/server2.js
    $ google-chrome http://localhost:3000/apidoc/

# Interesting facts

all the UI is based on bootstrap and implemented using undrscore templates. see folder src/ui/templates. the jst grunt task will execute underscore and gnerate a big file tempalte-output.js with all these .html templates compiled in javascript. 

Backbone routers are used for html navigation and bootstrap for the UI
