var synaptic = require('synaptic') // this line is not needed in the browser
var Neuron = synaptic.Neuron,
	Layer = synaptic.Layer,
	Network = synaptic.Network,
	Trainer = synaptic.Trainer,
	Architect = synaptic.Architect

var convert = require('../baseConverter')


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

// use this after you've trained - returns a pretty result
LearnerSum1.prototype.experiment = function (i, j){
	var resultBin = this.activate(this.buildInput(i, j))
	var output = this.buildOutput(i, j)
	this.propagate(this.sum1learningRate, output)

	resultBin = resultBin.map((n)=>Math.round(n))
	var result = convert.bin2dec(resultBin)
	return result
}

LearnerSum1.prototype.train = function (config){  //TODO:use a Trainer
	var trainingSet = this.buildTraningSet(config)
	this.sum1learningRate = this.sum1learningRate || .3
	for (var i = 0; i < config.iterations; i++) {
		trainingSet.map((s)=>{
			this.activate(s.input)
			this.propagate(this.sum1learningRate, s.output)
		})
	}
}
LearnerSum1.prototype.buildTraningSet = function (config){
	var trainingSet = []
	for (var i = config.from; i <= config.to; i++) {
		for (var j = config.from; j <= config.to; j++) {
			//first i+j
			var input = this.buildInput(i, j)
			var output = this.buildOutput(i, j)
			trainingSet.push({input,output})

			//then j+i
			// if(i!=j){
				input = this.buildInput(j, i)
				output = this.buildOutput(j, i)
				trainingSet.push({input,output})
			// }
		}
	}
	return trainingSet
}
module.exports = LearnerSum1
