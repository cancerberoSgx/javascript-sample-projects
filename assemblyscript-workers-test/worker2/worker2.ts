import { Application } from "./worker/application";
import { state } from "./worker/state";

let app: Application

onmessage = async function (e) {
  if(e.data.canvas){
    console.log('WRKER: Message received from main script', e);
    app = new Application(e.data.canvas)
    await app.start()
    app.paint()
  }
  else if(e.data.onkeypress){
    app.onKeyPress(e.data.onkeypress)
  }

  // async function main() {
  //   var memory = new WebAssembly.Memory({ initial: 2048 });
  //   const response = await fetch("build/optimized.wasm")
  //   const buffer = await response.arrayBuffer()
  //   const module = await WebAssembly.instantiate(buffer, {
  //     env: { memory },
  //     Math: Math as any
  //   })    
  //   const f1 = module.instance.exports.f1 as any
  //   console.log('asd', f1());
  //   postMessage(f1(), undefined as any);
  // }
  // main()
}


export { }
