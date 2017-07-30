
var doExperiment = require('./experiment').doExperiment

var config = {
	Class: require('./learner/LearnerSum1'),
	biggestNumber: 20,
	from: 1, 
	to: 10, 
	experimentFrom: 2,
	experimentTo: 4,
	iterations: 10,
	extraExperiments: [{a:12,b:13}]
}
doExperiment(config)