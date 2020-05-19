import * as i from './index'

export function layout() {
  const e = append(`
<style>
  * {
    padding: 0; 
    margin: 0;
  }

  html,
  body {
    height: 100%;
    margin: 0;
    overflow: hidden;
    color: #111;
    background: #fff;
    font-family: sans-serif;
  }

  h1 {
    font-size: 12pt;
  }

  a {
    color: #111;
    text-decoration: none;
  }

  a:hover {
    color: #0074C1;
    text-decoration: underline;
  }

  canvas {
    position: absolute;
    top: 50px;
    width: calc(100% - 0px);
    height: calc(100% - 50px);
    background: #eee;
  }

  canvas.gradient {
    left: 0;
    top: 0px;
    height: 2px;
    width: 100%;
  }
</style>

<h1>
  <a href="https://en.wikipedia.org/wiki/Mandelbrot_set">Mandelbrot set</a> in
  <a href="http://assemblyscript.org">AssemblyScript</a>
</h1>
<div>Press '+' and '-' to zoom in and out and 'a', 'w', 's', 'd' to move around. FPS: <span class="fps"></span>
  <label><input class="animate" type="checkbox">animate?</label>
  <label>Log: <span class="log"></span></label>
</div>
<canvas></canvas>
  `);
}

function log(a:any){
  document.querySelector('.log').innerHTML=a+''
}
function append(s, parent = document.body) {
  const e = document.createElement('div');
  e.innerHTML = s;
  parent.append(e);
  return e;
}
