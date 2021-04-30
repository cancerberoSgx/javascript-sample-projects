import { collection } from "./db";
import { moviesGenres } from "../common/metadata";

(async ()=>{
  const col = await collection('movies')
    moviesGenres.map(async g=>{
      try {
        // const q  = {genres: {$not: {$elemMatch: {$nin: [g]}}}}
        const results = await col.find(q).toArray()
        console.log(g, results.length);
      } catch (error) {
        console.trace(error)
      }
    })
})()