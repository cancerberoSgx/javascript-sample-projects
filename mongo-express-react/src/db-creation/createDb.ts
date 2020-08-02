import { trace } from "console";
import { readFileSync } from "fs";
import { Movie } from "../types";
import { collection } from "../server/db";

async function main() {
  try {
    const col = await collection('movies')
    await col.drop()

    const movies = JSON.parse(readFileSync('static/movies.json').toString())
    const result = await col.insertMany(movies)
    console.log(`Inserted ${result.result.n}, ${result.ops.length}`);

    process.exit(0)
  } catch (error) {
    trace(error)
    process.exit(1)

  }
}
main()
