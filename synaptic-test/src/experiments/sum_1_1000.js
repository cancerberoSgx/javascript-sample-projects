var experiment = require('../experiment')
var doExperiment = experiment.doExperiment
var buildNetworkFileName = experiment.buildNetworkFileName
var convert = require('../baseConverter')

var FROM = 1, TO = 1000
var binOperandSize  = convert.dec2bin(TO*2).length 
var hiddenNeuronCount = 20 // TODO: purely heuristic!

var config = {
	name: 'sum1',
	Class: require('../learner/LearnerSum1'),
	// biggestNumber: 20,
	from: FROM, 
	to: TO, 
	error: .01,
	log: 50,
	experimentFrom: FROM+1,
	experimentTo: TO-1,
	// iterations: 11900,
	hiddenNeuronCount: hiddenNeuronCount,
	// rate: 0.5,
	extraExperiments: [{a:TO+23, b: TO+11}, {a:TO+22,b:FROM+31}, {a:FROM+14,b:TO+21}, {a:TO+34,b:TO+13}],
	binOperandSize: binOperandSize
}
config.file = buildNetworkFileName(config)
doExperiment(config)