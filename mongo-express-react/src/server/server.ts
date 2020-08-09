import express from 'express'
import { celebrate, Segments, Joi } from 'celebrate'
import { port } from './config'
import { collection } from './db'
import { Movie, SearchResult } from '../types'
import { resolve } from 'path'
import { readFile, readFileSync } from 'fs'

const app = express()

app.get('/v1/search',
  celebrate({
    [Segments.QUERY]: {
      skip: Joi.number().optional(),
      limit: Joi.number().optional(),
    },
  }),
  async (req, res, next) => {
    try {
      const skip = parseInt(req.query.skip + '')
      const limit = parseInt(req.query.limit + '')
      const movies = await collection<Movie>('movies')
      const result: SearchResult = {
        total: await movies.count(),
        skip,
        limit,
        results: await movies.find({}, { limit, skip }).toArray()
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
