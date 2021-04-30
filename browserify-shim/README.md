Using browserify and browserify-shim for unifying javascript module definition 
============================

Key technologies: node, browserify, browserify-shim, jquery, backbone, underscore, express. 

This project's big objective is to use browserify for defining client side moduls just using the same infraestructure as in node (require/exports/module). 
Usage: 

    $ npm install
    $ sudo npm install -g browserify
    $ browserify js/main.js -o main-browserify.js
    $ google-chrome index.html

Also there is a very simple node express servr that serves static files and will call browserify for each request so changes are automatically loaded when user reload the document for easy development: 

    $ node server.js
    $ google-chrome http://localhost:3000

This application consists on a very simple server.js and a client application main.js. 

All the javascript is modularized using node's require() and in fact some module shared.js is shared and loaded both by client and server using the same API require(). 

The client javascript must be "browserified" this is, concatenated and add support for require/module/exports in the browser so it can be included in html. 

Also we define dependencies and load some vendor javascript libraries not compatible with browserify like jquery, underscore and backbone. These dependencies are defined in package-json and managed by browserify-shim for let us reference them in our code with a simple require() call. 

Interesting fact about this is that these vendor libraries are defined in package-json with dependency support, for example backbone depends on jquery and underscore.