// public end user api to execute an experiment: 
function doExperiment(config){

	var learner = new config.Class(config.biggestNumber)

	console.log('Training ('+config.iterations+')...')
	learner.train(config)

	//experiment several ops and print errors
	var errorCount=0, totalCount=0
	for (var i = config.experimentFrom; i <= config.experimentTo; i++) {
		for (var j = config.experimentFrom; j <= config.experimentTo; j++) {
			var value=learner.experiment(i, j)
			console.log(i, '+', j, value)
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
}
module.exports = {doExperiment}
