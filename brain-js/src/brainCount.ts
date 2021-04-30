// teach  to count so if intput is 1,2,3 should answer 4, input 3,4,5,6,7 should anwer 8
// const brain = require('brain.js')
import * as brain from 'brain.js'
const trainingData = [
  [1,2,3,4,5],
  [5,4,3,2,1],[6,7,8,9,10],[7,6,5,4,3],
];

const net = new brain.recurrent.LSTMTimeStep();

net.train(trainingData, {});

console.log(net.run([1,2,3,4]));
console.log(net.run([5,6,7,8]));

// bonus 10-5, 5-10