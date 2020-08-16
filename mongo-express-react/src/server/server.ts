import { celebrate, Joi, Segments } from 'celebrate'
import express from 'express'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Movie, SearchResult } from '../types'
import { port } from './config'
import { collection } from './db'
import { moviesGenres } from '../common/metadata'

const app = express()

app.get('/v1/search',
  celebrate({
    [Segments.QUERY]: {
      skip: Joi.number().optional(),
      limit: Joi.number().optional(),
      genres: Joi.string().optional().empty().allow(null).allow(''),
    },
  }),
  async (req, res, next) => {
    try {
      const skip = parseInt(req.query.skip + '')
      const limit = parseInt(req.query.limit + '')
      const genres = (req.query.genres ? (req.query.genres + '') : '').split(',').map(s => s.trim()).filter(s => s)
      if (genres.find(g => !moviesGenres.includes(g))) {
        return next(new Error('Invalid genres ' + genres.join(', ')))
      }
      const movies = await collection<Movie>('movies')
      const query = {}
      console.log(genres);
      if (genres.length) {
        Object.assign(query, { genres: { $not: { $elemMatch: { $nin: genres } } } })
      }
      const options = { limit, skip }
      const result: SearchResult = {
        skip,
        limit,
        total: await movies.count(query),
        results: await movies.find(query, options).toArray()
      }
      res.json(result)
    } catch (error) {
      next(error)
    }
  }
)

app.use(express.static(resolve('dist')));

const indexHtml = readFileSync('dist/index.html').toString()

app.use((req, res, next) => {
  if (['/search', '/test'].includes(req.path) && req.method.toLowerCase() === 'get') {
    res.send(indexHtml)
  } else {
    next()
  }
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
