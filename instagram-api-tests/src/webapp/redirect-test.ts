// generate certificates: https://github.com/FiloSottile/mkcert
// same as server.ts but using axios instead of curl

import * as express from 'express'
import { readFileSync } from 'fs'
import { createServer } from 'https'
import { exec } from 'shelljs'

var app = express()

app.get('/', async function (req, res) {
  res.type('html')
  res.send(`<a href="/redirect">Redirect</a>`)
})
app.get('/redirect', async function (req, res) {
  res.redirect('myapp://')
})

createServer({
  key: readFileSync('certificates2/example.com+5-key.pem'),
  cert: readFileSync('certificates2/example.com+5.pem')
}, app)
  .listen(443, 'example.test', function () {
    console.log('Example app listening at https://example.test')
  })

function curl(command: string, format: 'object' | 'formattedString' = 'object') {
  const r = exec(command, { silent: true })
  const obj = JSON.parse(r.stdout)
  if (format === 'formattedString') {
    return JSON.stringify(obj, null, 2)
  }
  else {
    return obj
  }
}
