import { Architect, Trainer, Network } from 'synaptic'
import {dec2bin, bin2dec} from '../baseConverter'

function main() {
  const network = new Architect.Perceptron(2, 2, 1)
  var trainer = new Trainer(network)
  var trainingSet = [
    {
      input: [0, 0],
      output: [0]
    },
    {
      input: [0, 1],
      output: [1]
    },
    {
      input: [1, 0],
      output: [1]
    },
    {
      input: [1, 1],
      output: [0]
    },
  ]
  trainer.train(trainingSet, {
    rate: .1,
    iterations: 20000,
    error: .005,
    shuffle: true,
    // log: 1000,
    cost: Trainer.cost.CROSS_ENTROPY
  });

  // network.propagate([0,0])
  const result = network.activate([0,0])
  console.log(network.activate([0,0]), network.activate([0,1]), network.activate([1,0]), network.activate([1,1]));
  
  console.log(dec2bin(13), bin2dec([ 1, 1, 0, 1 ]));
  
}

main()