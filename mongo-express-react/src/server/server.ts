import * as express from 'express'
import { celebrate, Segments, Joi } from 'celebrate'
import { port } from './config'
import { collection } from './db'
import { Movie } from '../types'

const app = express()

app.get('/v1/search',
  celebrate({
    [Segments.QUERY]: {
      skip: Joi.number().optional(),
      limit: Joi.number().optional(),
    },
  }),
  async (req, res, next) => {
    const movies = await collection<Movie>('movies')
    res.json({status: 'ok', size: (await movies.find({}).toArray()).length})
  }
)

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
