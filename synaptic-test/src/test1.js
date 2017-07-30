var LearnerSum1 = require('./learner/LearnerSum1')

function test1(){ // will teach how to 
	var learner = new LearnerSum1(20)

	console.log('Training...')
	learner.train({from: 1, to: 10, iterations: 12000})

	//experiment several ops and print errors
	var errorCount=0, totalCount=0
	for (var i = 2; i <= 10; i++) {
		for (var j = 2; j <= 4; j++) {
			var value=learner.experiment(i, j)
			// console.log(i, '+', j, value)
			if(i+j!=value){
				errorCount++
			}
			totalCount++
		}
	}
	console.log('errors: ', errorCount, 'of', totalCount, 'error rate:', Math.round(errorCount/totalCount*100), '%')
	console.log('out of range experiment: 11 + 12 == ', learner.experiment(11,12))
}
test1()
