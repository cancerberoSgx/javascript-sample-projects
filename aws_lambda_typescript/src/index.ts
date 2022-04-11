import * as moment from 'moment';
import { connect, DBConfig, query } from './db';
import axios from 'axios'

export async function handler(event: any) {
  const r:any = {}
  const config : DBConfig = {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    user: process.env.DB_USERNAME
  }

  r.config = config
  try {
    await connect(config)
    r.result = await query('select count(id) from profile')
    // r.internetResult = await axios.get('https://api.prod.cloud.findmotto.com/version', {timeout: 4000})
  } catch (error) {
    r.error = error
    r.errorStack = error.stack
  }
  const response = {
    statusCode: 200,
    body: JSON.stringify(`Hello from Lambda! moment: ${moment().format('MMMM Do YYYY, h:mm:ss a')}, mysql query: ${JSON.stringify(r, null, 2)}`),
  };
  return response;
}
