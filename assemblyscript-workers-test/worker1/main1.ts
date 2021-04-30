
function append(s, parent = document.body) {
  const e = document.createElement('div');
  e.innerHTML = s;
  parent.append(e);
  return e;
}

const e = append(`
<button class="block">block</button>
<canvas id="canvas-worker" width="400" height="200"></canvas>
`)
const offscreen = document.querySelector('canvas').transferControlToOffscreen();
// const worker = new Worker('myworkerurl.js');
const worker = new Worker('worker1.ts')
worker.postMessage({ canvas: offscreen }, [offscreen]);

e.querySelector('.block').addEventListener('click', e=>{
  blockFor()

})
// worker.postMessage({hello: 'world'});
console.log('HOST: Message posted to worker');

// setTimeout(() => {
//   blockFor()
// }, 1000);

/** blocks the thread for given ms. For testing purposes. */
function blockFor(ms=1000) {
  let t0 = Date.now()
  while(Date.now()-t0<ms){
    ;
  }
}
export {}
