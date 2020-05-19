import { layout } from "./layout"
import { Application } from "./application"

async function main() {
  try {
    layout()
    const app = await new Application().start()
    app.paint()
  } catch (error) {
    alert("Failed to load WASM: " + error.message + " (ad blocker, maybe?)");
    console.log(error.stack);
  }
}

main()
