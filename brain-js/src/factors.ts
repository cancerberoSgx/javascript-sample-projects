// trains a neural  to see niumebr is prime
// we represent numbers with its binary 


import * as brain from 'brain.js'
import { writeFileSync, readFileSync } from 'fs';

const loadFile = false
const N = 1131
const pad = new Number(N).toString(2).length

function decimalToBinaryArray(n: number) {
  return new Number(n).toString(2).padStart(pad, '0').split('').map(Number)
}
// function binaryArrayToDecimal(n: number[]) {
//   return parseInt(n.join(''), 2)
// }
function build(a: number, b:number) {
  return {
    input: input(a),
    output: [b],
    a:a
  }
}
function isPrime(n:number){
  if(n===0||n===1){return 1}
  for (let i = 2; i < Math.round(n/2); i++) {
    if(n%i===0){
      return 0
    }    
  }
  return 1
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
  return Math.round(n[0])
  // var a = n.slice(0,pad-1)
  // var b = n.slice(pad)

  // return [binaryArrayToDecimal(a.map(Math.round)),binaryArrayToDecimal(b.map(Math.round))]
  // else {

  // }
}

// console.log(isPrime(2) , factors(18));
// process.exit(1)

const data = []
for (let i = 0; i < N; i++) {
  // for (let j = 0; j < N; j++) {
    data.push(build(i, isPrime(i) ? 1 : 0))
  // }
}

let net: brain.NeuralNetwork
if(loadFile){
  net =  new brain.NeuralNetwork().fromJSON(JSON.parse(readFileSync('primes.json').toString()))
  console.log('Net loaded from file');
  
}
else {
  // const hiddenLayers = [Math.round(Math.log2(N))*Math.round(Math.log2(N))+1, Math.round(Math.log2(N))+1];//Math.round(N/2),Math.round(N/2)]//,Math.round(N/2)]
  const hiddenLayers = [Math.round(N/2)]


// 
  // const hiddenLayers = [40,20];//Math.round(N/2),Math.round(N/2)]//,Math.round(N/2)]
  // const hiddenLayers = [ Math.round(N/2)] //, Math.round(N/2)];
  console.log(hiddenLayers);
  
   net = new brain.NeuralNetwork({
     hiddenLayers, 
    // leakyReluAlpha: Math.random(),
  });
  net.train(shuffle(data), {
    // errorThresh: 0.05,
    timeout: 40000,
    log: console.log.bind(console),
    // logPeriod: 1, 
  })
  // (net as any).N = N
  writeFileSync('primes_'+N+'.json',JSON.stringify( net.toJSON(), null, 2));
}

// console.log(Cdata);

  
// console.lCog(result(net.run(input(6))))//, result(net.run(input(6))));

  for (let i = 0; i < N; i++) {
    // for (let j = 0; j < N; j++) {
      const f = isPrime(i) ? 1: 0
      // const r = i + j
      //  if(i>=N ||j>=N){continue}
      // if(r>=N){break}
      const actual = result(net.run(input(i)))
      // console.log(actual);      
      if (actual!==f) {
        console.log(i+' : actual: ' + actual + ': expected: '+f)
      }
  // }
}

console.log('Now verifying results outside data training');

let miss = 0, hit= 0, maxPrime = 0, maxNonPrime = 0//maxOps = []
for (let i = N; i < N*2; i++) {
  // for (let j = 0; j < N*2; j++) {
    const r = isPrime(i)
    // if(i<N &&j<N){continue}
    let actual = result(net.run(input(i)))
    // hit = hit + r === actual ? 1 : 0
    if (r===actual ) {
      hit++
      if(r && i>maxPrime){
        maxPrime = i
        // maxOps= [i]
      }
      if(!r &&i>maxNonPrime){
        maxNonPrime=i
      }
      // console.log(i + '+' + j + '===' + actual)
    }
    else {
    //   console.log('err');
     miss++ 
    }
    // actual = result(net.run(input(j, i)))
    // if (r === actual ) {
    //     hit++
    //   // console.log(j + '+' + i + '===' + actual)
    // }else {
    //   r>=N &&  miss++
    // }
  // }
}

console.log({N, hit, miss, maxPrime, maxNonPrime});

 