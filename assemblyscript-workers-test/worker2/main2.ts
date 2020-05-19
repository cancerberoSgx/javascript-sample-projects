
function append(s, parent = document.body) {
  const e = document.createElement('div');
  e.innerHTML = s;
  parent.append(e);
  return e;
}

async function main2() {
  const e = append(`
<style>

html,
body {
  height: 100%;
  margin: 0;
  overflow: hidden;
  color: #111;
  background: #fff;
  font-family: sans-serif;
}
canvas {
  position: absolute;
  top: 50px;
  width: calc(100% - 0px);
  height: calc(100% - 50px);
  background: #eee;
}
</style>

  <button class="block">block</button>
  <canvas></canvas>
  `)
  e.querySelector('.block').addEventListener('click', e => {
    blockFor()
  })
  const canvas = document.querySelector('canvas')
  var bcr = canvas.getBoundingClientRect()
  const downSampleFactor = 0.5
  canvas.width = (bcr.width | 0)*downSampleFactor
  canvas.height = (bcr.height | 0)*downSampleFactor
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker('worker2.ts')
  worker.postMessage({ canvas: offscreen }, [offscreen]);

  function installKeys() {
    document.onkeypress = e => {
      worker.postMessage({ onkeypress: { key: e.key, shiftKey: e.shiftKey } }, []);
    }
  }
  installKeys()
  // worker.postMessage({hello: 'world'});
  console.log('HOST: Message posted to worker');
}
function installKeys() {
  document.onkeypress = e => {
    worker.postMessage({ onkeypress: { key: e.key, shiftKey: e.shiftKey } }, []);
  }
}
main2()

function blockFor(ms = 1000) {
  let t0 = Date.now()
  // setTimeout(() => {
  //   blocked = false
  // }, ms);
  while (Date.now() - t0 < ms) {
    ;
  }
}

export { }