var experiment = require('../experiment')
var doExperiment = experiment.doExperiment
var buildNetworkFileName = experiment.buildNetworkFileName
var convert = require('../baseConverter')

var FROM = 1, TO = 100
var binOperandSize  = convert.dec2bin(TO*2).length + 1
var hiddenNeuronCount = binOperandSize*(binOperandSize/3)

var config = {
	name: 'sum1',
	Class: require('../learner/LearnerSum1'),
	// biggestNumber: 20,
	from: FROM, 
	to: TO, 
	error: .009,
	log: 100,
	experimentFrom: FROM+1,
	experimentTo: TO-1,
	// iterations: 11900,
	hiddenNeuronCount: hiddenNeuronCount,
	// rate: 0.5,
	extraExperiments: [{a:TO+3, b: TO+1}, {a:TO+2,b:FROM+1}, {a:FROM+4,b:TO+1}, {a:TO+4,b:TO+3}],
	binOperandSize: binOperandSize
}
config.file = buildNetworkFileName(config)
doExperiment(config)