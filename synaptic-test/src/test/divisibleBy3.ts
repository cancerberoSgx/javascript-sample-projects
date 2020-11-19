import { Architect, Trainer, Network } from 'synaptic'
import { dec2bin, bin2dec } from '../baseConverter'
import { number2input_straight } from '../inputUtil'
import { array } from 'misc-utils-of-mine-generic'

// learn to detect numbers divisible by 3
function main() {
  const max = 100
  const numberSize = dec2bin(max).length + 2
  const network = new Architect.Perceptron(numberSize, numberSize, 1)
  var trainer = new Trainer(network)
  const trainingSet = array(max).map(i => ({
    input: [...number2input_straight(i, numberSize)],
    output: [i % 3 === 0 ? 1 : 0]
  }))
  trainer.train(trainingSet, {
    rate: .1,
    iterations: 20000,
    error: .005,
    shuffle: true,
    cost: Trainer.cost.CROSS_ENTROPY
  });
  console.log(network.activate(number2input_straight(101, numberSize)));
  console.log(network.activate(number2input_straight(102, numberSize)));
}

main()