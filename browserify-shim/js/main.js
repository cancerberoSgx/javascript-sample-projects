//browser main require file - all browserify / require dependencies will be computed starting from this file.

//load jquery and make sure is available in the browser
var $ = require('jquery'); 

var View1 = require('./view1.js'); 

var view1 = new View1({});
view1.render();
$(document.body).append(view1.$el); 
// $(document.body).append('<p>hello</p>'); 
