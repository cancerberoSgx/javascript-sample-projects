this["jsCodeEditor"] = this["jsCodeEditor"] || {};
this["jsCodeEditor"]["template"] = this["jsCodeEditor"]["template"] || {};

this["jsCodeEditor"]["template"]["About"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<h1>Perforce (p4) history visual stats viewer. </h1>\n<p>See some <a data-bypass href="/apidoc/">API documentation here</a>. </p>\n<p>Author: Sebastián Gurin - sgurin</p>';

}
return __p
};

this["jsCodeEditor"]["template"]["Charts1"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<h3>Some charts...</h3>\n<div class="chart" id="charts1_1"></div>';

}
return __p
};

this["jsCodeEditor"]["template"]["Layout"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div data-template=\'NavBarMain\'>\n</div>\n\n\n<div class="container body">\n\t\n\n  <div id="mainViewContainer"></div>\n\n</div>';

}
return __p
};

this["jsCodeEditor"]["template"]["ListChangelists"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 
var data = view.application.dataManager.data; 
;
__p += '\n\n<div class="ListChangelistsView">\n\n<div class="row">\n\t<div class="col-md-8">\n\t<span>Order By</span>\n\t\t<select data-action="orderby">\n\t\t\t<option value="changelist">Changelist</option>\n\t\t\t<option value="date">Date</option>\n\t\t\t<option value="user">User</option>\n\t\t</select>\t\n\t</div>\n  <div class="col-md-4">\n  </div>\n</div>\n<div class="row">\n\t<div class="col-md-12">\n\t\t';
 if(!data){;
__p += '\n\t\t<p>No data to display, please load some data first using <a href="/perforce-config">Perforce Configuration tool</a></p>\n\t\t';
 } 
		else {;
__p += '\n\t\t<table  class="table table-responsive">\n\t\t\t<thead>\n\t          <tr>\n\t            <th>Changelist</th>\n\t            <th>Date</th>\n\t            <th>User</th>\n\t            <th>Message</th>\n\t          </tr>\n\t        </thead>\n\t        <tbody>\n\t        \t';
 _(data).each(function(changelist){
        		;
__p += '\n        \t\t\t<tr>\n        \t\t\t\t<td>' +
((__t = ( changelist.changelist)) == null ? '' : __t) +
'</td>\n        \t\t\t\t<td>' +
((__t = ( changelist.date)) == null ? '' : __t) +
'</td>\n        \t\t\t\t<td>' +
((__t = ( changelist.user)) == null ? '' : __t) +
'</td>\n\n        \t\t\t</tr>\n        \t\t';

	        	}); ;
__p += '\n\t        </tbody>\n\t\t</table>\n\t\t';
 } ;
__p += '\n\t</div>\n</div>\n\n<div>';

}
return __p
};

this["jsCodeEditor"]["template"]["NavBarMain"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '\n<div class="navbar navbar-inverse navbar-static-top" role="navigation">\n  <div class="container">\n    <div class="navbar-header">\n      <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">\n        <span class="sr-only">Toggle navigation</span>\n        <span class="icon-bar"></span>\n        <span class="icon-bar"></span>\n        <span class="icon-bar"></span>\n      </button>\n      <a class="navbar-brand" href="#">Perforce Visual Stats</a>\n    </div>\n    <div class="collapse navbar-collapse"> \n\n\t<ul class="nav navbar-nav" data-nav="root">\n\n\t\t<li>\n\t\t\t<a href="/about">About</a>\n\t\t</li>\t\t\n\n\t\t<li class="dropdown">\n\t        <a href="#" class="dropdown-toggle" data-toggle="dropdown">Perforce<b class="caret"></b></a>\n\t\t\t<ul class="dropdown-menu">\n\t\t\t\t<li><a href="/perforce-config" data-nav="leaf">Configuration</a></li>\n\t\t\t\t<li><a href="/perforce-listChangelists" data-nav="leaf">List Changelists</a></li>\n\t\t\t</ul>\n\t\t</li>\n\n\t\t<li class="dropdown">\n\t        <a href="#" class="dropdown-toggle" data-toggle="dropdown">Version Control <b class="caret"></b></a>\n\t\t\t<ul class="dropdown-menu">\n\t\t\t\t<li><a href="#">Perforce</a></li>\n\t\t\t\t<li><a href="#">Subversion</a></li>\n\t\t\t\t<li><a href="#">Git</a></li>\n\t\t\t</ul>\n\t\t</li>\n\n\t</ul>\n    </div>\n  </div>\n</div> \n';

}
return __p
};

this["jsCodeEditor"]["template"]["PerforceConfig"] = function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '\n<h3>Perforce Configuration</h3>\n<p>The following are perforce configuration properties for obtaining the changelists we want to display. </p>\n\n<form role="form">\n  <div class="form-group">\n    <label for="fileInput">Perforce file</label>\n    <input type="text" id="fileInput" class="form-control" name="file" placeholder="//depot/My Repositories/Project1/...">    \n    <p class="help-block">Depot file name or folder in which case it must ends with "/..."</p>\n  </div>\n  <div class="form-group">\n    <label for="usersInput">Users</label>\n    <input type="password" id="usersInput" class="form-control" placeholder="">\n    <p class="help-block">Optional. Multiple users must be separated with comma, like sgurin,bgates,rstallman</p>\n  </div>\n  <div class="form-group">\n    <label for="maxResultsInput">Maximun Result Count</label>\n    <input type="number" name="maxresults" id="maxResultsInput" value="1500">\n    <p class="help-block"> </p>\n  </div>\n  <button type="submit" class="btn btn-default">Load Changelists</button>\n</form>\n\n<br/>\n<p><b>Also</b> you can drag and drop a perforce change dump file from your desktop. You can generate the dump file like this: </p>\n\n<pre>\n$ p4 changes -l -m 1500 //MyRepository/myProject/... > dump.txt\n</pre>\n\n<p dropzone class="lead">Drop here your initial files!</p>\n\n<p class="output1"></p>';

}
return __p
};