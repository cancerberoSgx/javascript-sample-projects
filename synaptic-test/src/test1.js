
var doExperiment = require('./experiment').doExperiment

var config = {
	Class: require('./learner/LearnerSum1'),
	// biggestNumber: 20,
	from: 1, 
	to: 40, 
	error: .01,
	log: 400,
	experimentFrom: 12,
	experimentTo: 24,
	// iterations: 11900,
	hiddenNeuronCount: 20,
	extraExperiments: [{a:52,b:53}]
}
doExperiment(config)