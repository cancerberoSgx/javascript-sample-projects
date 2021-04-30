import { array, dec2bin, binaryDigitNormalizer, binaryStraightNormalizer } from 'misc-utils-of-mine-generic'
import { Architect, Trainer, Network } from 'synaptic'

// learn to detect numbers divisible by 3
function main_Perceptron_stright() {
  const max = 200
  const inputSize = dec2bin(max).length + 2
  const network = new Architect.Perceptron(inputSize, Math.round(inputSize * 1), 1)
  var trainer = new Trainer(network)
  const expected = n => n % 3 === 0 ? 1 : 0
  const trainingSet = array(max).map(i => ({
    input: [...binaryDigitNormalizer.encode(i, inputSize)],
    output: [expected(i)]
  }))
  trainer.train(trainingSet, {
    rate: [0.01],
    iterations: 20000,
    error: .0005,
    shuffle: true,
    cost: Trainer.cost.CROSS_ENTROPY
  }
  );
  test({
    network, inputSize, max,
    many: 30,
    number2input: binaryDigitNormalizer.encode,
    expected
  })
}
function main_LSTM_straight() {
  const max = 200
  const inputSize = dec2bin(max).length + 2
  const network = new Architect.LSTM(inputSize, 4, 1)
  var trainer = new Trainer(network)
  const expected = n => n % 3 === 0 ? 1 : 0
  const trainingSet = array(max).map(i => ({
    input: [...binaryDigitNormalizer.encode(i, inputSize)],
    output: [expected(i)]
  }))
  trainer.train(trainingSet, {
    rate: [0.01],
    iterations: 20000,
    error: .00005,
    shuffle: true,
    cost: Trainer.cost.CROSS_ENTROPY
  }
  );
  test({
    network, inputSize, max,
    many: 60,
    number2input: binaryDigitNormalizer.encode,
    expected
  })
}

function main_Perceptron_digitBin() {
  const max = 100
  const digitSize = binaryStraightNormalizer.encode(9).length
  const inputSize = binaryStraightNormalizer.encode(max).length + digitSize * 2
  console.log(digitSize, inputSize, binaryStraightNormalizer.encode(17), binaryStraightNormalizer.encode(63));
  
  const network = new Architect.Perceptron(inputSize, Math.round(inputSize * 1), 1)
  var trainer = new Trainer(network)
  const expected = n => n % 3 === 0 ? 1 : 0
  const trainingSet = array(max).map(i => ({
    input: [...binaryStraightNormalizer.encode(i, inputSize)],
    output: [expected(i)]
  }))
  trainer.train(trainingSet, {
    rate: 0.1,
    iterations: 20000,
    error: .005,
    shuffle: true,
    cost: Trainer.cost.CROSS_ENTROPY
  }
  );
  test({
    network, inputSize, max,
    many: 10,
    number2input: binaryStraightNormalizer.encode,
    expected
  })
}
main_Perceptron_digitBin()

interface TestOptions {
  network: Network,
  inputSize: number,
  max: number,
  many: number,
  number2input(a: number, inputSize: number): number[]
  expected(n: number): Printable
}
type Printable = string | number
function test({ network, inputSize, max, many, number2input, expected }: TestOptions) {
  const oks = [], misses = []
  array(many).map(i => i + max + 1).forEach(n => {
    const activation = network.activate(number2input(n, inputSize))[0]
    const finalResult = activation < .5 ? 0 : 1
    if (finalResult === expected(n)) {
      oks.push(n)
    } else {
      misses.push(n)
    }
    // console.log(`number: ${n} activation: ${activation} module: ${expected(n)}`)
  })
  console.log(`oks: ${oks.length}, misses: ${misses.length}`);
}
