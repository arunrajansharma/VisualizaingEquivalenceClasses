'use strict';

/**
* @ngdoc overview
* @name compBioProjectApp
* @description
* # compBioProjectApp
*
* Main module of the application.
*/
angular
.module('compBioProjectApp', [
	'ngAnimate',
	'ngCookies',
	'ngResource',
	'ngRoute',
	'ngSanitize',
	'ngTouch'
	])
.config(function ($routeProvider) {
	$routeProvider
	.when('/', {
		templateUrl: 'views/main.html',
		controller: 'MainCtrl',
		controllerAs: 'main'
	})
	.otherwise({
		redirectTo: '/'
	});
}).run(function() {
	sigma.classes.graph.addMethod('neighbors', function(nodeId) {
		var k, neighbors = {}, index = this.allNeighborsIndex[nodeId] || {};
		for (k in index)
			neighbors[k] = this.nodesIndex[k];
		return neighbors;
	});
});
