Using browserify, browserify-shim and grunt watch
============================

Key technologies: node, browserify, browserify-shim, jquery, backbone, underscore, express, grunt, grunt-contrib-watch. 

This is a clone of a simpler prject browserify-shim with support for grunt and grunt-contrib-watch and grunt-browserify for watching file changes and automatically excute browserify. 


This project's big objective is to use browserify for defining client side moduls just using the same infraestructure as in node (require/exports/module). 
Usage: 

    $ npm install
    $ grunt watch & 
    $ node server.js & 
    $ google-chrome localhost:3000 &

For killing all the above processes you can: 

    $ killall grunt node

Interesting parts of this project are:

* all shim dependencies are dfined in package.json
* grunt watch is responsible of watching source files changs and execute browserify
* node servr.js is a small static server, nothing more.