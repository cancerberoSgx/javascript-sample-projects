var synaptic = require('synaptic') // this line is not needed in the browser
var Neuron = synaptic.Neuron,
	Layer = synaptic.Layer,
	Network = synaptic.Network,
	Trainer = synaptic.Trainer,
	Architect = synaptic.Architect

var convert = require('../baseConverter')


function AbstractLearner(config, dontInit)
{
	this.config = config

	this.config.rate = this.config.rate || .2

	this.config.binOperandSize = this.config.binOperandSize || convert.dec2bin(this.operationImpl(this.config.to,this.config.to)).length + 1

	if(!config._dontInit){
		// create the layers
		var inputLayer = new Layer(this.config.binOperandSize*2)

		// var hiddenLayer = new Layer(this.config.binOperandSize*2) // TODO : should be dynamic rel of binOperandSize
		this.config.hiddenNeuronCount = this.config.hiddenNeuronCount || this.config.binOperandSize*this.config.binOperandSize
		var hiddenLayer = new Layer(this.config.hiddenNeuronCount)

		var outputLayer = new Layer(this.config.binOperandSize)

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
}

// extend the prototype chain
AbstractLearner.prototype = new Network()
AbstractLearner.prototype.constructor = AbstractLearner

AbstractLearner.prototype.operationImpl = function(){
	throw new Error('Must implement abstract method')
}
AbstractLearner.prototype.buildInput = function (i, j){
	var binOperand1 = convert.dec2bin(i, this.config.binOperandSize)
	var binOperand2 = convert.dec2bin(j, this.config.binOperandSize)
	return binOperand1.concat(binOperand2)
}
AbstractLearner.prototype.buildOutput = function (i, j){
	return convert.dec2bin(i+j, this.config.binOperandSize)
}

// use this after you've trained - returns a pretty result
AbstractLearner.prototype.experiment = function (i, j){
	var resultBin = this.activate(this.buildInput(i, j))
	var output = this.buildOutput(i, j)
	this.propagate(this.config.rate, output)

	resultBin = resultBin.map((n)=>Math.round(n))
	var result = convert.bin2dec(resultBin)
	return result
}

AbstractLearner.prototype.train = function (){ 
	var trainingSet = this.buildTraningSet(this.config)

	var trainer = new Trainer(this)

	var trainConfig = this.config
	trainer.train(trainingSet, trainConfig);
}

AbstractLearner.prototype.buildTraningSet = function (config){
	var trainingSet = []
	for (var i = config.from; i <= config.to; i++) {
		for (var j = config.from; j <= config.to; j++) {
			//first i+j
			var input = this.buildInput(i, j)
			var output = this.buildOutput(i, j)
			trainingSet.push({input,output})

			//then j+i
			input = this.buildInput(j, i)
			output = this.buildOutput(j, i)
			trainingSet.push({input,output})
		}
	}
	return trainingSet
}
module.exports = AbstractLearner
