import express from 'express'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { port } from './config'
import { installSearch } from './search'

const app = express()

installSearch(app)

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
