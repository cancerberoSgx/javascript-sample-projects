// generate certificates: https://github.com/FiloSottile/mkcert
// same as server.ts but using axios instead of curl

import * as express from 'express'
import { readFileSync } from 'fs'
import { createServer } from 'https'
import { exec } from 'shelljs'
import axios from 'axios'
import { stringify } from 'qs'

const REDIRECT_URL = 'https://example.test/'
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

let shortLiveToken = ''
let userId = ''

var app = express()

app.get('/', async function (req, res) {
  res.type('html');
  if (req.url.includes('?code=')) {
    // redirected from instagram auth window with the code param
    const code = req.url.substring(req.url.indexOf('?code=') + '?code='.length, req.url.length)
    let response = await axios({
      method: "post",
      url: "https://api.instagram.com/oauth/access_token",
      data: stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URL,
        code
      }),
      headers: { "Content-Type": 'application/x-www-form-urlencoded' },
    })
    // console.log('1', response.status, response.data, '\n\n');
    console.log(response.data);

    shortLiveToken = response.data.access_token
    userId = response.data.user_id

    response = await axios({
      method: "get",
      url: `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${CLIENT_SECRET}&access_token=${shortLiveToken}`,
      headers: { "Content-Type": 'application/x-www-form-urlencoded' },
    })

    const longTermToken = response.data.access_token
    // console.log('LTT RESPONSE: ', response.status, response.data);

    try {
      
    response = await axios({
      method: "get",
      url: `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${shortLiveToken}`,
      headers: { "Content-Type": 'application/x-www-form-urlencoded' },
    })

    console.log('REFRESH RESPONSE: ', response.status, response.data);

  } catch (error) {
      console.log(error.response.status, error.response.data);
      
  }


  //   curl -i -X GET "https://graph.instagram.com/refresh_access_token
  // ?grant_type=ig_refresh_token
  // &access_token={long-lived-access-token}"
    

  //   curl -i -X GET "https://graph.instagram.com/access_token
  // ?grant_type=ig_exchange_token
  // &client_secret={instagram-app-secret}
  // &access_token={short-lived-access-token}"

    response = await axios({
      method: "get",
      // url: `https://graph.instagram.com/${userId}/media?fields=id,media_type,permalink,timestamp,username,thumbnail_url,media_url,caption&access_token=${accessToken}`,
      url: `https://graph.instagram.com/${userId}/media?fields=id,media_type,media_url&access_token=${shortLiveToken}`,
      headers: { "Content-Type": 'application/x-www-form-urlencoded' },
    })
    const userMedia = JSON.stringify(response.data, null, 2)

    res.send(`
        <p>Authorization code obtained: ${code}</p>
        <pre>${'command'}</pre>
        <div>
        Access token response: 
        <pre>${/* JSON.stringify(accessTokenResponse)*/''}</pre>
        </div>
        <div>User info: 
          <pre>${curl(`curl -X GET \
        'https://graph.instagram.com/${userId}?fields=id,username&access_token=${shortLiveToken}'`, 'formattedString')}</pre>
        </div>
        <div>User media: 
          <pre>${userMedia}</pre>
        </div>
        `)
  }
  else {
    // first screen
    const url = `https://api.instagram.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&scope=user_profile,user_media&response_type=code`
    res.send(`
    <a href="${url}">Connect</a>
    `)
  }
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
