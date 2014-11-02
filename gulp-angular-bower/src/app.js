var phonecatApp = angular.module('phonecatApp', [
'ngRoute',
'phonecatControllers'
]);

var phonecatControllers = angular.module('phonecatControllers', []);

//set defualt route
phonecatApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.          
      otherwise({
        redirectTo: '/phones'
      });
  }]);
