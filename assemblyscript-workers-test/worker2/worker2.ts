import { Application } from "./worker/application";
import { sleep } from "misc-utils-of-mine-generic";

let app: Application

onmessage = async function (e) {
  try {
    if (e.data.initialize) {
      app = new Application(e.data.initialize.canvas)
      await app.start()
      app.paint()
    }
    if (e.data.paint) {
      app.paint()
    }
    if (e.data.state) {
      app.setState(e.data.state)
      app.paint()
    }
    else if (e.data.onkeypress) {
      app.onKeyPress(e.data.onkeypress)
    }
    else if (e.data.onclick) {
      app.onClick(e.data.onclick)
    }
    else if (e.data.test1) {
      console.log('w received');
      await sleep(1000)
    }
    postMessage({ status: 0, __timestamp: e.data.__timestamp }, undefined)
  } catch (error) {
    postMessage({ status: 1, __timestamp: e.data.__timestamp, error }, undefined)
  }

}


export { }
