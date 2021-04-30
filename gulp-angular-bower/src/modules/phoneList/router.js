var phonecatApp = angular.module('phonecatApp');

phonecatApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.

      when('/phones', {
        templateUrl: 'src/modules/phoneList/template.html',
        controller: 'PhoneListCtrl'
      });
  }]);
