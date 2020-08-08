import { trace } from "console";
import { readFileSync } from "fs";
import { collection, getDb } from "../server/db";

async function main() {
  try {
    const db = await getDb()
    // drop will fail if collection doesn't exists so we try to create it first
    try {
      await db.createCollection('movies')
    } catch (error) {
    }
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
