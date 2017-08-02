var experiment = require('../experiment2')
var doExperiment = experiment.doExperiment
var buildNetworkFileName = experiment.buildNetworkFileName
var convert = require('../baseConverter')

var FROM = 1, TO = 10
var binOperandSize  = convert.dec2bin(TO*2).length + 1

var config = {
	name: 'sum1',
	Class: require('../learner/LearnerSum1'),
	// biggestNumber: 20,
	from: FROM, 
	to: TO, 
	// error: (TO-FROM)*.000006,
	log: 100,
	experimentFrom: FROM+1,
	experimentTo: TO-1,
	mode: 'liquid',
	// iterations: 221900,
	// trainingMaxCountPerIteration: 10,
	hiddenNeuronCount: binOperandSize*(binOperandSize/3),
	// hiddenNeuroLayerCount: 1,
	rate: 0.2,
	extraExperiments: [{a:TO+3, b: TO+1}, {a:TO+2,b:FROM+1}, {a:FROM+4,b:TO+1}, {a:TO+4,b:TO+3}],
	binOperandSize: binOperandSize
}
config.file = buildNetworkFileName(config)
doExperiment(config)