var AbstractNaturalNumberOperationLearner2 = require('./AbstractNaturalNumberOperationLearner2')
function LearnerSum1()
{
	AbstractNaturalNumberOperationLearner2.apply(this, arguments)
}

LearnerSum1.prototype = new AbstractNaturalNumberOperationLearner2()
LearnerSum1.prototype.operationImpl = function(a, b){
	return a+b
}
module.exports = LearnerSum1
