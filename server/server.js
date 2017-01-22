var http = require('http');
var httpDispatcher = require('httpdispatcher');
var request=require('request');
var jsonfile = require('jsonfile')
var fs = require('fs');
var util = require('util');
var stream = require('stream');
var es = require('event-stream');

var dict = {};       // Object to hold the transcript:Eq Class Mapping
var final_data = {}; // Object to hold the final node and edge data
final_data.nodes = [];
final_data.edges = [];
var eq_transDict = {};
var txpNumtoName = {};
var edgeWeights = {};


var dispatcher = new httpDispatcher();

// Final response object to be returned
var finalResponse = [];

// A dict which contains eqClass: [eq1, eq2, ...]
var SmallDict = {};

// Weight Dictionary. Cluster of same weight
var weightDict  = {};

// Total number of L1 clusters
var totalNumOfL1CLusters = 0;

var finalL2Clusters = [];
var L1Clusters = [];
var L1Data = {};
var sizeofL2Clusters = {};		// Object to hold the per cluster size of L2 Nodes

var finalData = {};				// final Data to be rendered
finalData.L1Cluster = {};		// Top level cluster
finalData.L2Cluster = [];		// Mid level Cluster
finalData.L3Cluster = [];		// Actual Nodes and edges
var dbProcess = null;
var execFile = require('child_process').exec;

function handleRequest(request, response) {
	try {
		dispatcher.dispatch(request, response);
	} catch(err) {
		console.log(err);
	}
}

dispatcher.onGet('/compbio', function(req, res) {
	res.writeHead(200, {'Content-Type': 'application/json'});
});


function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomColor() {
	return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

// creation of weight dict
//	Weight 1 : C1, C5, C8 ...
// Weight 2 : C6, ...
var populateWeightDict = function(){
	console.log('Created Level2 Cluster Dictionary ...\n');
	var linenum = 0;
	var filename = 'resources/mcl_clusters';
	var s = fs.createReadStream(filename)
	.pipe(es.split())
	.pipe(es.mapSync(function(line) {
		s.pause();
		var len = line.split('\t').length;
		var id = 'W_' + len.toString();
		var strID = 'C' + linenum.toString();
		if (id in weightDict) {
			weightDict[id].push(strID);
		} else {
			weightDict[id] = [];
					// If it a new weight, means that this is a new L1 cluster
					totalNumOfL1CLusters += 1;
					weightDict[id].push(strID);
				}
				linenum++;
				s.resume();
			}).on('error', function() {
				console.log('Error while populating L2Nodes ...\n');
			}).on('end', function() {
				createL2Cluster();
			})
			);
};

// Actual creation of L2 Cluster
var createL2Cluster = function () {
	console.log('Generated Level2 Cluster Nodes ...\n');
	var inc = 10;
	var curr_x = 0;
	var curr_y = inc;
	for (var key in weightDict) {
		L1Clusters.push(key);
		var templ2dict = {};
		templ2dict['id'] = key;
		templ2dict['nodes'] = [];
		templ2dict['edges'] = [];
		var tempL2clusters = [];
		var clusterListPerWeight = weightDict[key];
		for(var i=0; i<clusterListPerWeight.length; i++) {
			curr_x++;
			if (curr_x > Math.sqrt(clusterListPerWeight.length)) {
				curr_x = 0;
				curr_y += inc;
			}
			tempL2clusters.push({
				id:clusterListPerWeight[i],
				label:clusterListPerWeight[i],
				size:sizeofL2Clusters[clusterListPerWeight[i]],
				x:Math.random(),
				y:Math.random(),
				color: getRandomColor()
			});
		}
		templ2dict.nodes = tempL2clusters;
		finalL2Clusters.push(templ2dict);
	}
	populateL1Clusters();
};

// Creation of top level clusters
var populateL1Clusters = function () {
	console.log('Generated Level1 Cluster Nodes ...\n');
	L1Data['nodes'] = [];
	L1Data['edges'] = [];
	var inc = 10;
	var curr_x = 0;
	var curr_y = inc;
	for(var key in weightDict) {
		curr_x++;
		if (curr_x > Math.sqrt(totalNumOfL1CLusters)) {
			curr_x = 0;
			curr_y += inc;
		}
		L1Data.nodes.push({
			id:key,
			label:'' + key,
			size:sizeofL2Clusters[weightDict[key][0]],
			x:Math.random(),
			y:Math.random(),
			color: getRandomColor()
		});
	}
	finalData.L1Cluster = L1Data;
	finalData.L2Cluster = finalL2Clusters;
	finalData.L3Cluster = finalResponse;
	var file = 'db.json';
	if (dbProcess) {
		stopProcess(dbProcess);
	}
	jsonfile.writeFile(file, finalData, {spaces: 2}, function (err) {
		console.error(err);
		dbProcess = startDB();
	});
};

// Creation of nodes of bottommost layer
var populateL3Nodes = function(){
	console.log('Going to populate the Level 3 Nodes ...\n');
	var maxClusterSize = 0;		// Number to denote max numbers of items in a cluster. Since
	var clusterId = 0;
	var filename = 'resources/mcl_clusters';
	var s = fs.createReadStream(filename)
	.pipe(es.split())
	.pipe(es.mapSync(function(line) {
		s.pause();
		var linelist = line.split('\t');
		var inc = 10;
		var curr_x = 0;
		var curr_y = inc;
		var L2Nodes = [];
		for(var i=0; i<linelist.length; i++) {
			maxClusterSize = linelist.length;
			curr_x++;
			if(curr_x > Math.sqrt(maxClusterSize)) {
				curr_x = 0;
				curr_y += inc;
			}
				// Push the L3 (Bottom Nodes)
				L2Nodes.push({
					id:linelist[i],
					label:'Node'+linelist[i],
					size:1,
					x:Math.random(),
					y:Math.random(),
					color: getRandomColor()
				});
			}
			// Add the List of nodes to the Cluster List
			finalResponse.push({
				id: 'C' + clusterId,
				nodes: L2Nodes,
				edges: []
			});
			// populate the size of this cluster
			var clusterNode = 'C' + clusterId.toString();
			sizeofL2Clusters[clusterNode]= linelist.length;
			clusterId++;
			s.resume();
		}).on('error', function() {
			console.log('Error while populating L3Nodes(per cluster).');
		}).on('end', function() {
			populateL3Edges();
		})
		);
};

// Creation of edges of bottommost layer
var populateL3Edges = function(){
	console.log('Creating (per cluster) edges for level 3 ...\n');
	var filename = 'resources/mcl_clusters';
	var edgeDict = {};			// Dictionary to prune redundant edges. Make it an undirected graph
	var clusterId = 0;
	var s = fs.createReadStream(filename)
	.pipe(es.split())
	.pipe(es.mapSync(function(line) {
		s.pause();
		var linelist = line.split('\t');
		var edgeid = 0;
		var L2EdgesTemp = [];
		linelist.forEach(function(node_i, index_i, arr_i) {
			linelist.forEach(function(node_j, index_j, arr_j) {
				if(!SmallDict || !SmallDict[node_i] ||
					!SmallDict[node_i][node_j] ||
					SmallDict[node_i][node_j] < 0.5)
					return;

				L2EdgesTemp.push({
					id:'Edge' + edgeid,
					source:node_i,
					target:node_j,
					weight:SmallDict[node_i][node_j]
				});
				edgeid++;
			});
		});
		if(L2EdgesTemp.length>0){
			finalResponse[parseInt(clusterId)].edges = L2EdgesTemp;
		}
		clusterId++;
		s.resume();
	}).on('error', function() {
		console.log('Error while populating L2Edges.');
	}).on('end', function() {
		populateWeightDict();
	})
	);
};

// Function to get the union of two arrays.
function union_arrays (x, y) {
	var obj = {};
	for (var i = x.length-1; i >= 0; --i)
		obj[x[i]] = x[i];
	for (var i = y.length-1; i >= 0; --i)
		obj[y[i]] = y[i];
	var res = []
	for (var k in obj) {
		if (obj.hasOwnProperty(k))  // <-- optional
			res.push(obj[k]);
	}
	return res;
}

var makeDictionary = function() {
	console.log("Creating Edge wait dictionary ...\n");
	var filename = 'resources/input_for_mcl';
	var s = fs.createReadStream(filename)
	.pipe(es.split())
	.pipe(es.mapSync(function(line) {
		s.pause();
		var linelist = line.split(' ');
		if (linelist[0] in SmallDict) {
			SmallDict[linelist[0]][linelist[1]] = linelist[2];
		} else {
			SmallDict[linelist[0]] = {};
			SmallDict[linelist[0]][linelist[1]] = linelist[2];
		}
		s.resume();
	}).on('error', function() {
		console.log('Error while reading file.');
	}).on('end', function() {
		populateL3Nodes();
	})
	);
};

var populateEdge = function() {
	// Uses eq_Trans - equivalence class to txp
	// dict - TXP to eq class list
	console.log("Populating Edges for Level 3 ...\n");
	var count = 0;
	for(source in eq_transDict) {
		var txps = eq_transDict[source];
		txps.forEach(function (txp) {
			var nodeList = dict[txp] || [];
			nodeList.forEach(function(target) {
				if(target !== source) {
					edgeWeights[source + '_' + target] = (edgeWeights[source + '_' + target] || 0) + 1;
				}
			});
		});
	}

	var count = 0;
	for(var edge in edgeWeights) {
		var edgePair = edge.split('_');
		final_data.edges.push({
			id: 'e' + count++,
			source: edgePair[0],
			target: edgePair[1],
			weight: (edgeWeights[edge] / (union_arrays(eq_transDict[edgePair[0]], eq_transDict[edgePair[1]])).length)
		});
	}
	var txtFile = 'resources/input_for_mcl';
	var str = '';
	final_data.edges.forEach(function(edge, index, arr) {
		str += edge.source + ' ' + edge.target + ' ' + edge.weight + (index != arr.length - 1 ? '\n' : '');
	});
	fs.writeFile(txtFile, str, function(err) {
		if(err) {
			return console.log(err);
		}
		console.log('Input file for MCl generated ...\n');
		executeMcl();
	});
};

// Function to parse the data and create a dict Object
var create_dict = function(filename) {
	console.log('Creating transcript to Eq Class Dictionary ...\n');
	var lineNum = 0;
	var numEqv = 0;
	var numTrans = 0;
	var node_label = 'Node ';
	var countx = 0;     // Max allowed pixel length for x coordinate
	var county = 0;     // Max allowed pixel length for y coordinate
	var curr_x = 0;     // Current position for x coordinate
	var curr_y = 0;     // Current position for y coordinate
	var incr_x = 5;     // Increment for x coordinate
	var incr_y = 5;     // Increment for y coordinate


	var s = fs.createReadStream(filename)
	.pipe(es.split())
	.pipe(es.mapSync(function(line) {
		s.pause()
		if (lineNum == 0) {
					// First Line Number. Number of transcripts.
					numTrans = parseInt(line);
				} else if (lineNum == 1) {
					// Number of Eq Classes
					numEqv = parseInt(line);
					countx = Math.ceil(Math.sqrt(numEqv));
					county = Math.ceil(Math.sqrt(numEqv));
				} else if(lineNum > 1 && lineNum <= numTrans + 1) {
					// Parse the Txp name to generate a mapping called txp number to name mapping
					txpNumtoName[lineNum - 1] = line;
				} else if(lineNum >= numTrans + 2) {
					// Eq Class
					lineList = line.split('\t');
					var i = 0;
					var n = lineList[0];
					for (i=1; i<=Number(n); i++) {
						var l = txpNumtoName[lineList[i] - 1];
						var a = (lineNum - numTrans - 2).toString();
						// Populate the eq-Trans Dict
						if (a in eq_transDict) {
							eq_transDict[a].push(l);
						} else {
							eq_transDict[a] = [];
							eq_transDict[a].push(l);
						}
						// Create dict DS for processing
						if (l in dict) {
							dict[l].push(a);
						} else {
							dict[l] = [];
							dict[l].push(a);
						}
					}
					// Populate The Node.
					var temp_dict = {};
					var a = (lineNum - numTrans - 2).toString();
					temp_dict['id'] = a;   // Node ID = Eq Class Num. = Line num in file.
					temp_dict['label'] = node_label.concat(a);
					temp_dict['size'] = 1;
					if (curr_x >= countx * incr_x) {
						// x overflows the canvas
						temp_dict['x'] = curr_x;
						temp_dict['y'] = curr_y;
						curr_x = 0;
						curr_y += incr_y;
					} else {
						temp_dict['x'] = curr_x;
						temp_dict['y'] = curr_y;
						curr_x += incr_x;
					}
					// Populate Node ends
					final_data.nodes.push(temp_dict);
				}
				lineNum++;
				s.resume();
			}).on('error', function() {
				console.log('Error while reading file.');
			}).on('end', function() {
				populateEdge();
			})
			);
};

var executeMcl = function() {
	console.log('Running MCL on data set. ...\n');
	const child = execFile('mcl resources/input_for_mcl --abc -I 4 -o resources/mcl_clusters', {}, (error, stdout, stderr) => {
		if(error) {
			console.log(error, stdout, stderr);
			console.log('Please consult README. In case, all steps are performed perfectly yet error occurs contact team.');
		}
		console.log('Generated Final Clustered data.\n');
		makeDictionary();
	});
}

var startDB = function() {
	const dbChild = execFile('json-server --watch db.json', {}, (error, stdout, stderr) => {
		if(error) {
			console.log(error, stdout, stderr);
			console.log('Please consult README. In case, all steps are performed perfectly yet error occurs contact team.');
		}
		console.log('Started DB.');
	});
	return dbChild;
}

var stopProcess = function(childToKill) {
	childToKill.kill('SIGTERM');
}

http.createServer(handleRequest).listen(5010, function() {
	var filename = 'resources/eq_classes.txt';
	create_dict(filename);
});
