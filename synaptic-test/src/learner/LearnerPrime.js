var AbstractNaturalNumberOperationLearner = require('./AbstractNaturalNumberOperationLearner')
function LearnerPrime()
{
	AbstractNaturalNumberOperationLearner.apply(this, arguments)
}

LearnerPrime.prototype = new AbstractNaturalNumberOperationLearner()
LearnerPrime.prototype.operationImpl = function(a, b){
	return isPrime(a) ? 1 : 0
}

const isPrime = num => {
    for(let i = 2, s = Math.sqrt(num); i <= s; i++)
        if(num % i === 0) return false; 
    return num !== 1;
}

module.exports = LearnerPrime
