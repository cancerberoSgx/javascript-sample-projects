// trains a neural net to find primes factors (fermat)
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

const loadFile = false
const N = 30
const pad = new Number(N).toString(2).length

function decimalToBinaryArray(n: number) {
  return new Number(n).toString(2).padStart(pad, '0').split('').map(Number)
}
function binaryArrayToDecimal(n: number[]) {
  return parseInt(n.join(''), 2)
}

function build(a: number, output: number[]) {
  return {
    input: decimalToBinaryArray(a),
    output: decimalToBinaryArray(output[0]).concat(decimalToBinaryArray(output[1]))
  }
}
function isPrime(n:number){
  if(n===0||n===1){return true}
  for (let i = 2; i < Math.round(n/2); i++) {
    if(n%i===0){
      return false
    }    
  }
  return true
}
function factors(n:number){
  if(n===0){return [0,0]}
  if(n===1){return [1,1]}

  for (let i = 0; i <= n; i++) {
    if(!isPrime(i)){
      continue
    }
    for (let j = 0; j <= n; j++){
      if(!isPrime(j)){
        continue
      }
      if(i*i+j*j===n*n){
        return [i,j]
      }
    }
  }
  throw new Error('No factors found for '+n)
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

function input(a: number): number[] {
  return decimalToBinaryArray(a)
}

function result(n: number[]) {
  // let a = n
  if(!Array.isArray(n)){
    n = Object.values(n)
    // return binaryArrayToDecimal(Object.values(n).map(Math.round))
  }
  var a = n.slice(0,pad-1)
  var b = n.slice(pad)

  return [binaryArrayToDecimal(a.map(Math.round)),binaryArrayToDecimal(b.map(Math.round))]
  // else {

  // }
}

console.log(isPrime(2) , factors(18));
process.exit(1)

const data = []
for (let i = 0; i < N; i++) {
  // for (let j = 0; j < N; j++) {
    data.push(build(i,factors(i)))
  // }
}

let net: brain.NeuralNetwork
if(loadFile){
  net =  new brain.NeuralNetwork().fromJSON(JSON.parse(readFileSync('fermatLoad.json').toString()))
  console.log('Net loaded from file');
  
}
else {
  const hiddenLayers = [Math.round(N/2),Math.round(N/2)]//,Math.round(N/2)]
   net = new brain.NeuralNetwork({
     hiddenLayers, 
    leakyReluAlpha: Math.random(),
  });
  net.train(shuffle(data), {
    // errorThresh: 0.0005,
    log: console.log.bind(console),
    // logPeriod: 100, 
  })
  // (net as any).N = N
  writeFileSync('fermat_'+N+'.json',JSON.stringify( net.toJSON(), null, 2));
}
  
console.log(net.run(input(6)), result(net.run(input(6))));

//   for (let i = 0; i < N; i++) {
//     // for (let j = 0; j < N; j++) {
//       const f = factors(i)
//       // const r = i + j
//       //  if(i>=N ||j>=N){continue}
//       // if(r>=N){break}
//       const actual = result(net.run(input(i)))
//       // console.log(actual);      
//       if (actual[0]!=f[0]|| actual[1]!==f[1]) {
//         console.log(i+' !== ' + actual[0] + ' * '+actual[1])
//       }
//   // }
// }

// console.log('Now verifying results outside data training');

// let miss = 0, hit= 0, max = 0, maxOps = []
// for (let i = 0; i < N*2; i++) {
//   for (let j = 0; j < N*2; j++) {
//     const r = i + j
//     if(i<N &&j<N){continue}
//     let actual = result(net.run(input(i, j)))
//     // hit = hit + r === actual ? 1 : 0
//     if (r === actual ) {
//       hit++
//       if(r>max){
//         max = r
//         maxOps= [i,j]
//       }
//       // console.log(i + '+' + j + '===' + actual)
//     }
//     else {
//     //   console.log('err');
//     r>=N &&  miss++ 
//     }
//     actual = result(net.run(input(j, i)))
//     if (r === actual ) {
//         hit++
//       // console.log(j + '+' + i + '===' + actual)
//     }else {
//       r>=N &&  miss++
//     }
//   }
// }

// console.log({N, hit, miss, maxOps});

