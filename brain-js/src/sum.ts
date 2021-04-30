import * as brain from 'brain.js'
import { array, decimalDigitNormalizer } from 'misc-utils-of-mine-generic'

const max = 20
const inputSize = decimalDigitNormalizer.encode(max).length + 1
console.log(inputSize);

const trainingData = array(max).map(i => array(max).map(j => {
  return {
    input: [...decimalDigitNormalizer.encode(i, inputSize), ...decimalDigitNormalizer.encode(j, inputSize)],
    output: [...decimalDigitNormalizer.encode(i + j, inputSize)]
  }
})).flat()

const net = new brain.NeuralNetwork({ hiddenLayers: [inputSize] });
net.train(trainingData);
function test(i: number, j: number) {
  const r = decimalDigitNormalizer.decode(
    net.run([...decimalDigitNormalizer.encode(i, inputSize), ...decimalDigitNormalizer.encode(j, inputSize)])
  )
  console.log(`${i} + ${j} == ${i+j}, result: ${r}`);
}

test(11, 11)
test(19, 3)
test(12, 5)
test(7, 3)

// function numberToDigits(n: number, length?: number) {
//   let r= `${n}`.split('').map(i=>(parseInt(i)/10))
//   if(length && r.length>length) {
//     throw new Error('greater than length')
//   }
//   if(length && r.length<length) {
//     r = [...array(length - r.length).map(i=>0), ...r]
//   }
//   return r
// }

// function digitsToNumber(digits: number[]) {
//   return parseInt(digits.map(d=>Math.round(d*10)).join(''))
// }
// console.log(numberToDigits(1234), digitsToNumber(numberToDigits(1234)));

// const trainingData = [
//   { input: [0, 0], output: [0] },
//   { input: [0, 1], output: [1] },
//   { input: [1, 0], output: [1] },
//   { input: [1, 1], output: [2] }
// ];


// console.log(net.run([0, 0]).map(Math.round));
// console.log(net.run([1, 0]).map(Math.round));
// console.log(net.run([0, 1]).map(Math.round));
// console.log(net.run([1, 1]).map(Math.round));
// // console.log(net.run([0, 1]));
// // console.log(net.run([1, 0]));
// // console.log(net.run([1, 1]));

// console.log(brain.likely([0, 0], net));
// console.log(brain.likely([0, 1], net));
// console.log(brain.likely([1, 0], net));
// console.log(brain.likely([1, 1], net));


// console.log(net.run([0, 1]));
// console.log(net.run([1, 0]));
// console.log(net.run([1, 1]));