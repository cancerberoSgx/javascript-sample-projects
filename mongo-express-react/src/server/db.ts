import { MongoClient, Db } from 'mongodb'
import { dbUrl, dbName } from './config';

let client: MongoClient, db: Db

export async function getDb() {
  if(!client) {
    client = await MongoClient.connect(dbUrl)
    db = client.db(dbName)
  }
  return db
}

export async function collection<T>(name:string) {
  return (await getDb()).collection<T>(name)
}
