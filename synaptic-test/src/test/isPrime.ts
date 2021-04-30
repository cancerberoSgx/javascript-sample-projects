import { Architect, Trainer, Network } from 'synaptic'
import { array, isPrime ,  bin2dec, binaryDigitNormalizer, binaryStraightNormalizer, dec2bin} from 'misc-utils-of-mine-generic'

// learn to detect numbers divisible by 3
function main() {
  const max = 105
  const numberSize = dec2bin(max).length + 2
  const network = new Architect.Perceptron(numberSize, numberSize, 1)
  var trainer = new Trainer(network)
  const trainingSet = array(max).map(i => ({
    input: [...binaryDigitNormalizer.encode(i, numberSize)],
    output: [isPrime(i) ? 1 : 0]
  }))
  trainer.train(trainingSet, {
    rate: .1,
    iterations: 20000,
    error: .005,
    shuffle: true,
    cost: Trainer.cost.CROSS_ENTROPY
  });
  console.log(network.activate(binaryDigitNormalizer.encode(101, numberSize)), isPrime(101));
  console.log(network.activate(binaryDigitNormalizer.encode(102, numberSize)), isPrime(102));
  console.log(network.activate(binaryDigitNormalizer.encode(7, numberSize)));
}

main()