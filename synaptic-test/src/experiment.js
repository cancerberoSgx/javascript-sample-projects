var Network = require('synaptic').Network


	// public end user api to execute an experiment: 
function doExperiment(config){

	var learner

	if(config.file && shell.test('-f', config.file)){
		var data = JSON.parse(shell.cat(config.file))
		var learner = Network.fromJSON(data);
		config._dontInit = true
		config.Class.apply(learner, [config])
		Object.keys(config.Class.prototype).map((key)=>{
			learner[key]=config.Class.prototype[key]
		})
	}
	else{
		learner = new config.Class(config)
	}
	
	console.log('Doing experiment:\n',config)

	console.log('Training ('+config.iterations+')...')
	learner.train()

	//experiment several ops and print errors
	var errorCount=0, totalCount=0
	for (var i = config.experimentFrom; i <= config.experimentTo; i++) {
		for (var j = config.experimentFrom; j <= config.experimentTo; j++) {
			var value=learner.experiment(i, j)
			// console.log(i, '+', j, value)
			if(i+j!=value){
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

	// handleFileSave(config, learner)
	if(config.file){
		shell.ShellString( JSON.stringify(learner.toJSON())).to(config.file)
	}
}


function buildNetworkFileName(config){
	return './test/network/'+config.name+'_'+config.from+'_'+config.to+'_'+config.hiddenNeuronCount+'_'+config.binOperandSize+'.json'
}

var shell = require('shelljs')

module.exports = {doExperiment, buildNetworkFileName}
