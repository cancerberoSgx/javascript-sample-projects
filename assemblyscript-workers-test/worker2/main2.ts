import { state } from "./worker/state";
import { Deferred, sleep } from 'misc-utils-of-mine-generic'

function append(s, parent = document.body) {
  const e = document.createElement('div');
  e.innerHTML = s;
  parent.append(e);
  return e;
}


const worker = new Worker('worker2.ts')
const messages: { [timestamp: number]: Deferred<MessageEvent> } = {}

worker.addEventListener('message', e => {
  console.log('h message', e);
  
  if (e.data.__timestamp && messages[e.data.__timestamp]) {
    messages[e.data.__timestamp].resolve(e)
  }
})
function postMessage(message: any, transferable: Transferable[] = []) {
  const t = Date.now();
  worker.postMessage({ ...message, __timestamp: t }, transferable);
  messages[t] = new Deferred<MessageEvent>()
  return new Promise<MessageEvent>((resolve, reject) => {
    messages[t].then(resolve)
    // delete messages[t]
  })
}

function blockFor(ms = 1000) {
  let t0 = Date.now()
  while (Date.now() - t0 < ms) {
    ;
  }
}

async function main2() {
  const e = append(`
  <style>
  * {
    margin: 0; 
    padding: 0;
  }
  html, body {
    height: 100%;
    overflow: hidden;
  }
  canvas {
    width: calc(100% - 0px);
    height: calc(100% - 0px);
  }
  </style>

  <button class="block">block</button>
  <label>Zoom step <input class="zoom-step" type="number" value="${state.magnificationFactorStep}"></label>
  <br/>
  <canvas></canvas>
  `)
  e.querySelector('.block').addEventListener('click', e => {
    blockFor()
  })
  e.querySelector('.zoom-step').addEventListener('change', e => {
    worker.postMessage({ state: { magnificationFactorStep: (e.currentTarget as HTMLInputElement).valueAsNumber } }, []);
  })
  const canvas = document.querySelector('canvas')
  var bcr = canvas.getBoundingClientRect()
  const downSampleFactor = 0.3
  canvas.width = (bcr.width | 0) * downSampleFactor
  canvas.height = (bcr.height | 0) * downSampleFactor
  const offscreen = canvas.transferControlToOffscreen();
  worker.postMessage({ initialize: { canvas: offscreen } }, [offscreen]);
  worker.postMessage({ paint: {} }, []);

  document.onkeypress = e => {
    worker.postMessage({ onkeypress: { key: e.key, shiftKey: e.shiftKey } }, []);
  }
  canvas.addEventListener('click', e => {
    worker.postMessage({ onclick: { x: e.clientX, y: e.clientY, shiftKey: e.shiftKey } }, []);
  })
  console.log('h send');
  
  const response = await postMessage({ test1: {} })
  console.log('h received', response);

  let z = 11.0
  for (; z < 20.0; z+=0.1) {
    await postMessage({ state: {magnificationFactor: z} })
    worker.postMessage({ paint: {} }, []);
    await sleep(1)
  }

  for (;z >5; z-=0.1) {
    await postMessage({ state: {magnificationFactor: z} })
    worker.postMessage({ paint: {} }, []);
    await sleep(1)
  }
}

main2()


export { }