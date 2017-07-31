var AbstractLearner = require('./AbstractLearner')


function LearnerSum1()
{
	AbstractLearner.apply(this, arguments)
}

LearnerSum1.prototype = AbstractLearner.prototype
LearnerSum1.prototype.operationImpl = function(a, b){
	return a+b
}

// LearnerSum1.prototype = Object.assign({}, ) 
module.exports = LearnerSum1
