var phonecatApp = angular.module('phonecatApp');

phonecatApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.

      when('/phones/:phoneId', {
        templateUrl: 'src/modules/phoneDetail/template.html',
        controller: 'PhoneDetailCtrl'
      });
  }]);
