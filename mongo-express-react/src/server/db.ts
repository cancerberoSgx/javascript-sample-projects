import { MongoClient, Db } from 'mongodb'
import { dbUrl, dbName } from './config';

let client: MongoClient, db: Db

export async function getDb() {
  if (!client || !db) {
    client = await MongoClient.connect(dbUrl, { useUnifiedTopology: true })
    db = client.db(dbName,)
  }
  return db
}

export async function collection<T>(name: string) {
  return (await getDb()).collection<T>(name)
}

// export async function collectionExists(name:string){
//   const db = await getDb()
//   db.system.namespaces.find( { name: dbName +'.' + collectionName } );
// }