var doExperiment = require('./experiment').doExperiment
var convert = require('./baseConverter')
var buildNetworkFileName = require('./experiment').buildNetworkFileName


var FROM = 1, TO = 100

var binOperandSize  = convert.dec2bin(TO*2).length + 1
var hiddenNeuronCount = 33//binOperandSize*(binOperandSize/3)

var config = {
	name: 'sum1',
	Class: require('./learner/LearnerSum1'),
	// biggestNumber: 20,
	from: FROM, 
	to: TO, 
	// error: 0.04,
	log: 50,
	experimentFrom: FROM+1,
	experimentTo: TO-1,
	// iterations: 11900,
	hiddenNeuronCount: hiddenNeuronCount,
	// rate: 0.5,
	extraExperiments: [{a:TO+3, b: TO+1}, {a:TO+2,b:FROM+1}, {a:FROM+4,b:TO+1}],
	binOperandSize: binOperandSize
}
// config.file = buildNetworkFileName(config)



// process.on('SIGINT', function() {
//     console.log("Caught interrupt signal");
//     // if (i_should_exit)
//         process.exit(1);
// });
doExperiment(config)