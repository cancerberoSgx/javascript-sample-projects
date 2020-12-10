// trains a neural net to sum
// we represent numbers with its binary 
//  the input are two operands together in binary and output is the result in binary
// the training data has 0...N 0...N combination for both inputs
// IMPORTANT: we shuffle the training data
// the net   hiddenLayers: [N, N],
// for N around 40 we need the training error to be 0.0001

// results: for N == 431 - if ask to sum combinations for N*2 (only those operands that net never saw in its training), these are results: { N: 431, hit: 136094, miss: 978472, maxOps: [ 384, 511 ] }
// this means that in a training of operands of combinations of 0...431 the net knew how to sum numbers much higher than 431, like 384 and 511

import * as brain from 'brain.js'
import { writeFileSync, readFileSync } from 'fs';

const loadFile = true
const N = 431
const pad = new Number(N+N).toString(2).length

function decimalToBinaryArray(n: number) {
  return new Number(n).toString(2).padStart(pad, '0').split('').map(Number)
}
function binaryArrayToDecimal(n: number[]) {
  return parseInt(n.join(''), 2)
}

function build(a: number, b: number, output: number) {
  return {
    input: decimalToBinaryArray(a).concat(decimalToBinaryArray(b)),
    output: decimalToBinaryArray(output)
  }

}

function shuffle(a) {
  var j, x, i;
  for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      x = a[i];
      a[i] = a[j];
      a[j] = x;
  }
  return a;
}

function input(a: number, b: number): number[] {
  return decimalToBinaryArray(a).concat(decimalToBinaryArray(b));
}

function result(n: number[]) {
  if(Array.isArray(n)){
    return binaryArrayToDecimal(n.map(Math.round))
  }
  else {
    return binaryArrayToDecimal(Object.values(n).map(Math.round))

  }
}

const data2 = []
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    data2.push(build(i, j, i + j))
  }
}

let net: brain.NeuralNetwork
if(loadFile){
  net =  new brain.NeuralNetwork().fromJSON(JSON.parse(readFileSync('brainSumNetLoad.json').toString()))
  console.log('Net loaded from file');
  
}
else {
  const hiddenLayers = [Math.round(N/2),Math.round(N/2)]//,Math.round(N/2)]
   net = new brain.NeuralNetwork({
     hiddenLayers, 
    leakyReluAlpha: Math.random(),
  });
  net.train(shuffle(data2), {
    errorThresh: 0.0005,
    log: console.log.bind(console),
    // logPeriod: 100, 
  })
  // (net as any).N = N
  writeFileSync('brainSumNet_'+N+'.json',JSON.stringify( net.toJSON(), null, 2));
}
  
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const r = i + j
      //  if(i>=N ||j>=N){continue}
      // if(r>=N){break}
      const actual = result(net.run(input(i, j)))
      // console.log(actual);      
      if (r !== actual) {
        console.log(i + '+' + j + '!==' + r)
      }
  }
}

console.log('Now verifying results outside data training');

let miss = 0, hit= 0, max = 0, maxOps = []
for (let i = 0; i < N*2; i++) {
  for (let j = 0; j < N*2; j++) {
    const r = i + j
    if(i<N &&j<N){continue}
    let actual = result(net.run(input(i, j)))
    // hit = hit + r === actual ? 1 : 0
    if (r === actual ) {
      hit++
      if(r>max){
        max = r
        maxOps= [i,j]
      }
      // console.log(i + '+' + j + '===' + actual)
    }
    else {
    //   console.log('err');
    r>=N &&  miss++ 
    }
    actual = result(net.run(input(j, i)))
    if (r === actual ) {
        hit++
      // console.log(j + '+' + i + '===' + actual)
    }else {
      r>=N &&  miss++
    }
  }
}

console.log({N, hit, miss, maxOps});


// console.log(brain.likely(input(1,1), net));



// console.log(net.run([5,6,7,8]));

// // bonus 10-5, 5-10