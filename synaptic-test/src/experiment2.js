var Network = require('synaptic').Network
var AbstractNaturalNumberOperationLearner = require('./learner/AbstractNaturalNumberOperationLearner2')

	// public end user api to execute an experiment: 
function doExperiment(config){

	var learner = loadFromFile(config)
	// if(!learner){ 
	// 	learner = new config.Class(config)
	// }
	
	console.log('Doing experiment:\n',config)
	console.log('Training ('+config.iterations+')...')

	learner.train()

	//experiment several ops and print errors

		var secondOperandTo = config.oneOperand ? config.experimentFrom : config.experimentTo

	var errorCount=0, totalCount=0
	for (var i = config.experimentFrom; i <= config.experimentTo; i++) {
		for (var j = config.experimentFrom; j <= secondOperandTo; j++) {
			var value=learner.experiment(i, j)
			// console.log(i, '+', j, value, config.Class.prototype.operationImpl(i,j))
			if(config.Class.prototype.operationImpl(i, j)!=value){
				errorCount++
			}
			totalCount++
		}
	}
	console.log('errors: ', errorCount, 'of', totalCount, 'error rate:', Math.round(errorCount/totalCount*100), '%')
	config.extraExperiments=config.extraExperiments||[]
	config.extraExperiments.map((e)=>{
		console.log('extra experiment: ', e.a, e.b, '==', learner.experiment(e.a, e.b))
	})

	if(config.file){
		shell.ShellString( JSON.stringify(learner.network.toJSON())).to(config.file)
	}
}

function loadFromFile(config){
	var network
	var learner = new config.Class(config)
	if(config.file && shell.test('-f', config.file)){
		var data = JSON.parse(shell.cat(config.file))
		learner.network = Network.fromJSON(data);
	}
	return learner
}

function buildNetworkFileName(config){
	return './test/network/'+config.name+'_'+config.from+'_'+config.to+'_'+config.hiddenNeuronCount+'_'+config.binOperandSize+'.json'
}

var shell = require('shelljs')

module.exports = {doExperiment, buildNetworkFileName}
