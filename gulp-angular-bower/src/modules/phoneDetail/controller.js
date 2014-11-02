var phonecatControllers = angular.module('phonecatControllers');

phonecatControllers.controller('PhoneDetailCtrl', ['$scope', '$routeParams',

function($scope, $routeParams) 
{
	$scope.phoneId = $routeParams.phoneId;
}

]);