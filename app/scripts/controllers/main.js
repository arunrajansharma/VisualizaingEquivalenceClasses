'use strict';

/**
* @ngdoc function
* @name compBioProjectApp.controller:MainCtrl
* @description
* # MainCtrl
* Controller of the compBioProjectApp
*/
angular.module('compBioProjectApp')
.controller('MainCtrl', ['$scope', '$http', 'PanelConstant',
	function ($scope, $http, PanelConstant) {
		$scope.clickLevel = 1;
		$scope.relativePath = '/L1Cluster';
		$scope.prevL2Node = null;

		$scope.decrementClickLevel = function() {
				if($scope.clickLevel === 3) {
					$scope.relativePath = '/L2Cluster/' + $scope.prevL2Node;
					$scope.clickLevel--;
					$scope.executeSigma();
				} else if($scope.clickLevel === 2) {
					$scope.relativePath = '/L1Cluster';
					$scope.clickLevel--;
					$scope.executeSigma();
				}
		};

		$scope.executeSigma = function() {
			document.getElementById('sigma-container').innerHTML = '';
			sigma.parsers.json(PanelConstant.dbUrl + $scope.relativePath, {
				container: 'sigma-container'
			}, function(s) {
				s.graph.nodes().forEach(function(n) {
					n.originalColor = n.color;
				});
				s.graph.edges().forEach(function(e) {
					e.originalColor = e.color;
				});

				if($scope.clickLevel === 1) {
					s.bind('clickNode', function(e) {
						var nodeId = e.data.node.id;
						$scope.$apply(function() {
							$scope.prevL2Node = nodeId;
							$scope.relativePath = '/L2Cluster/' + nodeId;
							$scope.clickLevel++;
						});
						$scope.executeSigma();
					});
				} else if($scope.clickLevel === 2) {
					s.bind('clickNode', function(e) {
						var nodeId = e.data.node.id;
						$scope.$apply(function() {
							$scope.relativePath = '/L3Cluster/' + nodeId;
							$scope.clickLevel++;
						});
						$scope.executeSigma();
					});
				} else if($scope.clickLevel === 3) {
					s.bind('clickNode', function(e) {
						var nodeId = e.data.node.id,
						toKeep = s.graph.neighbors(nodeId);
						toKeep[nodeId] = e.data.node;
						s.graph.nodes().forEach(function(n) {
							if (toKeep[n.id])
								n.color = n.originalColor;
							else
								n.color = '#eee';
						});
						s.graph.edges().forEach(function(e) {
							if (toKeep[e.source] && toKeep[e.target])
								e.color = e.originalColor;
							else
								e.color = '#eee';
						});
						s.refresh();
					});
				}

				s.bind('clickStage', function(e) {
					s.graph.nodes().forEach(function(n) {
						n.color = n.originalColor;
					});
					s.graph.edges().forEach(function(e) {
						e.color = e.originalColor;
					});
					s.refresh();
				});
			});
		}
		$scope.executeSigma();
	}]);
