var angular = require('angular');

var app = angular.module("myApp", []);

app.controller("personController", function personController($scope) {
    $scope.firstName = "John";
    $scope.lastName = "Doe";

    $scope.names = [
		{name:'Jani',country:'Norway'},
		{name:'Hege',country:'Sweden'},
		{name:'Kai',country:'Denmark'}
	]; 
});

//Heads up! we don't need to use module.export for this to work because we use angular modules API - we just need someone to call require('./personController')



/*
OLD - a lonely controller
//controller variables need to be global
personController = function personController($scope) {
    $scope.firstName = "John";
    $scope.lastName = "Doe";

    $scope.names = [
		{name:'Jani',country:'Norway'},
		{name:'Hege',country:'Sweden'},
		{name:'Kai',country:'Denmark'}]; 
}; 

module.export = personController;
*/