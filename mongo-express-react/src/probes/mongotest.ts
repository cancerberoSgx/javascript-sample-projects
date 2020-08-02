

import { trace } from "console";
import { MongoClient } from 'mongodb'
import * as assert from 'assert'
import { readFileSync } from "fs";
import { Movie } from "../types";

async function createDb() {
  var url = 'mongodb://localhost:27017/myproject';
  const dbName = 'myproject';
  try {
    const client = await MongoClient.connect(url)
    // console.log("Connected correctly to server");
    const db = client.db(dbName)
    // const result = await db.collection('documents').insertMany([{ a: 1 }, { a: 2 }, { a: 3 }])
    // assert.equal(3, result.result.n);
    // assert.equal(3, result.ops.length);
    // // console.log("Inserted 3 documents into the document collection");
    
    console.log( (await ( await db.collection('movies').find({})).toArray()).length);
    
    await db.collection('movies').drop()
    console.log( (await ( await db.collection('movies').find({})).toArray()).length);

      const movies = JSON.parse(readFileSync('static/movies.json').toString())
    await db.collection('movies').insertMany(movies)

    let cursor = await db.collection<Movie>('movies').find( { genres: { $in: [ "Biography" ] } } )
    cursor.skip(5).limit(5)
    console.log((await cursor.toArray()).length);
    
    client.close()
    process.exit(0)
  } catch (error) {
    trace(error)
    process.exit(1)

  }
}
createDb()
