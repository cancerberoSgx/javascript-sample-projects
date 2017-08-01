var synaptic = require('synaptic') // this line is not needed in the browser
var Neuron = synaptic.Neuron,
	Layer = synaptic.Layer,
	Network = synaptic.Network,
	Trainer = synaptic.Trainer,
	Architect = synaptic.Architect

var convert = require('../baseConverter')


function AbstractNaturalNumberOperationLearner(config, dontInit)
{
	if(!config){return}
	this.config = config

	this.config.rate = this.config.rate || .2

	// this.config.binOperandSize = this.config.binOperandSize || convert.dec2bin(this.operationImpl(this.config.to,this.config.to)).length + 1

	if(config._dontInit){
		return
	}
	
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

// extend the prototype chain
AbstractNaturalNumberOperationLearner.prototype = new Network()
AbstractNaturalNumberOperationLearner.prototype.constructor = AbstractNaturalNumberOperationLearner

Object.assign(AbstractNaturalNumberOperationLearner.prototype, {

	operationImpl: function(){
		throw new Error('Must implement abstract method')
	},

	buildInput: function (i, j){
		var binOperand1 = convert.dec2bin(i, this.config.binOperandSize)
		var binOperand2 = convert.dec2bin(j, this.config.binOperandSize)
		return binOperand1.concat(binOperand2)
	},

	buildOutput: function (i, j){
		return convert.dec2bin(this.operationImpl(i, j), this.config.binOperandSize)
	},

	// use thi,s after you've trained - returns a pretty result
	experiment: function (i, j){
		var resultBin = this.activate(this.buildInput(i, j))
		var output = this.buildOutput(i, j)
		this.propagate(this.config.rate, output)

		resultBin = resultBin.map((n)=>Math.round(n))
		var result = convert.bin2dec(resultBin)
		return result
	},

	train: function (){ 
		var trainingSet = this.buildTraningSet(this.config)

		var trainer = new Trainer(this)

		var trainConfig = this.config
		trainer.train(trainingSet, trainConfig);
	},

	buildTraningSet_pass: function(config){
		if(this.config.trainingMaxCountPerIteration){
			var trainingRate = this.config.trainingMaxCountPerIteration / (this.config.to - this.config.from)
			return Math.random()<trainingRate
		}
		else{
			return true
		}
	},

	buildTraningSet: function (config){
		var trainingSet = []
		for (var i = config.from; i <= config.to; i++) {
			for (var j = config.from; j <= config.to; j++) {
				if(!this.buildTraningSet_pass()){
					continue;
				}
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
})

module.exports = AbstractNaturalNumberOperationLearner
