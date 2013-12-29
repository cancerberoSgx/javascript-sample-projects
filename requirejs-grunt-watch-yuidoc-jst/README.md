JavaScript sample project using backbone bootstrap requirejs grunt watch connect yuidoc jst (compiled underscore templates)
=============

Key technologies:
backbone bootstrap requirejs grunt watch connect yuidoc jst (compiled underscore templates)

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

# API Documentation

grunt-contrib-yuidoc is used for source code API  documentation in the form of jsdoc comments. When you run the servers (grunt run or node server/server2.js) sources are watched and when you change them, the API docs will be updated. For example:

    $ node server/server2.js
    $ google-chrome http://localhost:3000/apidoc/

# Interesting facts

all the UI is based on bootstrap and implemented using undrscore templates. see folder src/ui/templates. the jst grunt task will execute underscore and gnerate a big file tempalte-output.js with all these .html templates compiled in javascript. 

Backbone routers are used for html navigation and bootstrap for the UI
