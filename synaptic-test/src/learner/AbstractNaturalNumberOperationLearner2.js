

var synaptic = require('synaptic') // this line is not needed in the browser
var Neuron = synaptic.Neuron,
	Layer = synaptic.Layer,
	Network = synaptic.Network,
	Trainer = synaptic.Trainer,
	Architect = synaptic.Architect

var convert = require('../baseConverter')


function AbstractNaturalNumberOperationLearner2(config, dontInit)
{
	if(!config){return}
	this.config = config

	if(config._dontInit){
		return
	}

	this.config.mode = this.config.mode || 'perceptron'
	this.buildNetwork =this['buildNetwork_'+this.config.mode]
	
	this.buildNetwork()
}

// extend the prototype chain
AbstractNaturalNumberOperationLearner2.prototype = new Network()
AbstractNaturalNumberOperationLearner2.prototype.constructor = AbstractNaturalNumberOperationLearner2

Object.assign(AbstractNaturalNumberOperationLearner2.prototype, {

	operationImpl: function(){
		throw new Error('Must implement abstract method')
	},

	buildNetwork_perceptron: function(){
		var args = [this.config.binOperandSize*2]
		this.config.hiddenNeuroLayerCount = this.config.hiddenNeuroLayerCount || 1
		for (var i = 0; i < this.config.hiddenNeuroLayerCount; i++) {
			args.push(this.config.hiddenNeuronCount)
		}
		args.push(this.config.binOperandSize)
		this.network = new Architect.Perceptron(...args)
	},

	buildNetwork_liquid: function(){
		var input = this.config.binOperandSize*2;
		var pool = 40;
		var output = this.config.binOperandSize;
		var connections = 60;
		var gates = 20;
		this.network = new Architect.Liquid(input, pool, output, connections, gates);
	},

	buildInput: function (i, j){
		if(this.config.oneOperand){
			j=0
		}
		var binOperand1 = convert.dec2bin(i, this.config.binOperandSize)
		var binOperand2= convert.dec2bin(j, this.config.binOperandSize)

		return binOperand1.concat(binOperand2)
	},

	buildOutput: function (i, j){
		return convert.dec2bin(this.operationImpl(i, j), this.config.binOperandSize)
	},

	// format a result of calling this.activate into a decimal Number
	formatActivation: function (resultBin){
		resultBin = resultBin.map((n)=>Math.round(n))
		var result = convert.bin2dec(resultBin)
		return result
	},

	// use this after train - returns a pretty result
	experiment: function (i, j){
		var resultBin = this.network.activate(this.buildInput(i, j))
		var output = this.buildOutput(i, j)
		this.network.propagate(this.config.rate, output)

		return this.formatActivation(resultBin)
	},

	train: function (){ 
		var trainingSet = this.buildTraningSet(this.config)

		var trainer = new Trainer(this.network)

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
		var secondOperandTo = this.config.oneOperand ? config.from : config.to
		for (var i = config.from; i <= config.to; i++) {
			for (var j = config.from; j <= secondOperandTo; j++) {
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

module.exports = AbstractNaturalNumberOperationLearner2
