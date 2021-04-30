import { readdirSync, readFileSync } from "fs"
import { join } from "path"
import { query } from "../src/db"
import { asyncForEach } from "../src/util"
import { config } from '../src/config'

try {
  (async () => {
    await query(`DROP DATABASE IF EXISTS \`${config.dbName}\``);
    await query(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\``)
    await query(`USE \`${config.dbName}\``)
    const migrations = readdirSync('migrations').sort().map(migration => readFileSync(join('migrations', migration)).toString())
    await asyncForEach(migrations, sql => query(sql))
    process.exit(0)
  })();
} catch (error) {
  console.error(error)
  process.exit(1)  
}

export { }
