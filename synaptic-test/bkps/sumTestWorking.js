var synaptic = require('synaptic') // this line is not needed in the browser
var Neuron = synaptic.Neuron,
	Layer = synaptic.Layer,
	Network = synaptic.Network,
	Trainer = synaptic.Trainer,
	Architect = synaptic.Architect

var convert = require('./baseConverter')

function buildTraningSet(learner, from, to){
	// if(!learner.binOperandSize){
	// 	//TODO
	// 	learner.binOperandSize
	// }
	// console.log('learner.binOperandSize', learner.binOperandSize)
	var trainer = new Trainer(learner)
	var trainingSet = []
	for (var i = from; i <= to; i++) {
		for (var j = from; j <= to; j++) {
			// var binOperand1 = convert.dec2bin(i, learner.binOperandSize)
			// var binOperand2 = convert.dec2bin(j, learner.binOperandSize)
			var input = learner.buildInput(i, j)// binOperand1.concat(binOperand2)
			var output = learner.buildOutput(i, j)//

		//TODO: if binOperand1.length exeeds throw ex
			trainingSet.push({input,output})
			// if(i!=j){
				binOperand1 = convert.dec2bin(i, learner.binOperandSize)
				binOperand2 = convert.dec2bin(j, learner.binOperandSize)
				input = binOperand1.concat(binOperand2)
				output = convert.dec2bin(i+j, learner.binOperandSize)
				trainingSet.push({input,output})
			// }
		}
	}
	return trainingSet
}

function trainSum(learner, from, to){  //TODO:use a Trainer
	var trainer = new Trainer(learner)
	var trainingSet = buildTraningSet(learner, from, to)
	// console.log(trainingSet)

	// train the network
	learner.sum1learningRate = learner.sum1learningRate || .3
	for (var i = 0; i < 130000; i++) {
		trainingSet.map((s)=>{
			learner.activate(s.input)
			learner.propagate(learner.sum1learningRate, s.output)
		})
	}
}


function LearnerSum1(biggestNumber)
{
	this.binOperandSize = convert.dec2bin(biggestNumber).length
	// var inputSize = this.binOperandSize*2

	// create the layers
	var inputLayer = new Layer(this.binOperandSize*2)
	var hiddenLayer = new Layer(17) // TODO : should be dynamic rel of binOperandSize
	var outputLayer = new Layer(this.binOperandSize)

	// connect the layers
	inputLayer.project(hiddenLayer)
	hiddenLayer.project(outputLayer)

	// set the layers
	this.set({
		input: inputLayer,
		hidden: [hiddenLayer],
		output: outputLayer
	})
}

// extend the prototype chain
LearnerSum1.prototype = new Network()
LearnerSum1.prototype.constructor = LearnerSum1

LearnerSum1.prototype.buildInput = function (i, j){
	var binOperand1 = convert.dec2bin(i, this.binOperandSize)
	var binOperand2 = convert.dec2bin(j, this.binOperandSize)
	return binOperand1.concat(binOperand2)
}
LearnerSum1.prototype.buildOutput = function (i, j){
	return convert.dec2bin(i+j, this.binOperandSize)
}
LearnerSum1.prototype.experiment = function (i, j){
	var resultBin = this.activate(this.buildInput(i, j))
	var output = this.buildOutput(i, j)
	this.propagate(this.sum1learningRate, output)

	resultBin = resultBin.map((n)=>Math.round(n))
	// console.log('resultBin', resultBin)
	var result = convert.bin2dec(resultBin)
	return result
}

function test1(){
	var learner = new LearnerSum1(20)
	trainSum(learner, 1, 10)
	for (var i = 2; i <= 4; i++) {
		for (var j = 2; j <= 4; j++) {
			console.log(i, '+', j, learner.experiment(i, j))
		}
	}


	console.log(learner.experiment(11,12))
}
main()
