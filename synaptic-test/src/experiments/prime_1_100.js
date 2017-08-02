var experiment = require('../experiment')
var doExperiment = experiment.doExperiment
var buildNetworkFileName = experiment.buildNetworkFileName
var convert = require('../baseConverter')

var FROM = 1, TO = 1000
var binOperandSize  = convert.dec2bin(TO*2).length + 1
var hiddenNeuronCount = 100

var config = {
	name: 'prime1',
	Class: require('../learner/LearnerPrime'),
	// biggestNumber: 20,
	from: FROM, 
	to: TO, 
	// error: .004,
	log: 20,
	oneOperand: true, //heads up ! is one operand operation - marking as such will make iteration faster
	experimentFrom: FROM+1,
	experimentTo: TO-1,
	hiddenNeuronCount: hiddenNeuronCount,
	// trainingMaxCountPerIteration: 100,
	extraExperiments: [{a:1013, b: 9}, {a:1019, b: 9}, {a:1033, b: 9}],
	binOperandSize: binOperandSize,
	oneOperand: true,
	rate: 0.2
}
config.file = buildNetworkFileName(config)
doExperiment(config)