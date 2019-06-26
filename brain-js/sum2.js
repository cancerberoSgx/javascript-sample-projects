// input 0 0, output 0
// input 0 1, output 1
// input 1 0, output 1
// input 1 1, output 0
const brain = require('brain.js')

const net = new brain.NeuralNetwork({ hiddenLayers: [3] });

const trainingData = [
  { input: [0, 0], output: [0] },
  { input: [0, 1], output: [1] },
  { input: [1, 0], output: [1] },
  { input: [1, 1], output: [0] }
];

net.train(trainingData);

console.log(net.run([0, 0]).map(Math.round));
console.log(net.run([1, 0]).map(Math.round));
console.log(net.run([0, 1]).map(Math.round));
console.log(net.run([1, 1]).map(Math.round));
// console.log(net.run([0, 1]));
// console.log(net.run([1, 0]));
// console.log(net.run([1, 1]));

// console.log(brain.likely([0, 0], net));
// console.log(brain.likely([0, 1], net));
// console.log(brain.likely([1, 0], net));
// console.log(brain.likely([1, 1], net));


// console.log(net.run([0, 1]));
// console.log(net.run([1, 0]));
// console.log(net.run([1, 1]));