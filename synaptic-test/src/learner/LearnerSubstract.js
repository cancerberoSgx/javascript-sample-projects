var AbstractNaturalNumberOperationLearner = require('./AbstractNaturalNumberOperationLearner')
function LearnerSum1()
{
	AbstractNaturalNumberOperationLearner.apply(this, arguments)
}

LearnerSum1.prototype = new AbstractNaturalNumberOperationLearner()
LearnerSum1.prototype.operationImpl = function(a, b){
	return a+b
}
module.exports = LearnerSum1
