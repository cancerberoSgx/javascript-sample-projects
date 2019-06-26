const brain = require('brain.js')
// const net = new brain.NeuralNetwork();
// const trainingData = [
//   { input: [0, 0], output: [0] },
//   { input: [0, 1], output: [1] },
//   { input: [1, 0], output: [1] },
//   { input: [1, 1], output: [0] }
// ];

const trainingData = [
  { input: {a: 1.0, b: 2.0}, output: {result: 3.0} },
  { input: {a: 2.0, b: 1.0}, output: {result: 3.0} },
  { input: {a: 1.0, b: 1.0}, output: {result: 2.0} },
  // { input: {a: 1.0, b: 3.0}, output: {result: 4.0} },
  // { input: {a: 3.0, b: 1.0}, output: {result: 4.0} },
  // { input: {a: 2.0, b: 2.0}, output: {result: 4.0} },
  // { input: {a: 3.0, b: 0.0}, output: {result: 3.0} },
  // { input: {a: 0.0, b: 3.0}, output: {result: 3.0} },

  { input: {a: 0.0, b: 1.0}, output: {result: 1.0} },
  { input: {a: 0.0, b: 0.0}, output: {result: 0.0} },
  { input: {a: 1.0, b: 0.0}, output: {result: 1.0} },
  { input: {a: 2.0, b: 0.0}, output: {result: 2.0} },
  { input: {a: 0.0, b: 2.0}, output: {result: 2.0} },

  // { input: [0, 1], output: [1] },
  // { input: [1, 0], output: [1] },
  // { input: [1, 1], output: [0] }
];

const d2 = []
const N = 25
// for (let i = 0; i < N; i++) {
//   for (let j = i; j < N; j++) {
//     const result = i+j
//     // if(result>=10){break}
//     d2.push({
//       input: {[(i+'').padStart(4, '0')+'+'+(j+'').padStart(4, '0')]: 1},
//       output: {[(result+'').padStart(4, '0')]:1}
//     }); 
//     d2.push({
//       input: {[(j+'').padStart(4, '0')+'+'+(i+'').padStart(4, '0')]: 1},
//       output: {[(result+'').padStart(4, '0')]:1}
//     }); 
// }
// }

for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    const result = i+j
    if(result>=N){break}
    d2.push({
      input: {[i+'+'+j]: 1},
      output: {[(result+'')]:1}
    }); 
}
}

for (let i = N-1; i >= 0; i--) {
  for (let j = N; j >=0; j--) {
    const result = i+j
    if(result>=N){break}
    d2.push({
      input: {[i+'+'+j]: 1},
      output: {[(result+'')]:1}
    }); 
}
}

// for (let i = 0; i < N; i++) {
//   for (let j = 0; j < N; j++) {
//     const result = i+j
//     if(result>=N){break}
//     d2.push({
//       input: {[(i+'').padStart(4, '0')+'+'+((j+'').padStart(4, '0'))]: 1},
//       output: {[((result+'').padStart(4, '0'))]:1}
//     }); 
// }
// }

// console.log(d2);

const net = new brain.NeuralNetwork({ hiddenLayers: [35] });
// console.time('training')
const s = net.train(d2, {
  // errorThresh: 0.01,
    log: (error) => console.log(error)
});

// console.timeEnd('training')
// console.log(s);
// console.log(net.toJSON());

console.log(brain.likely(
  // {'0014+0005': 1}
  {[12+'+'+4]: 1}
, net))


for (let i = 0; i < N; i++) {
  for (let j = i; j < N; j++) {
    const result = i+j
    if(i+j>=N){break}
    // const s = (i+'').padStart(4, '0')+'+'+(j+'').padStart(4, '0')
    console.log(j+'+'+i, '=', brain.likely(
      // {'0014+0005': 1}
      // {[s]: 1}
    // , net), brain.likely(
      // {'0014+0005': 1}
      {[j+'+'+i]: 1}
    , net))
  }
}