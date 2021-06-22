// generate certificates: https://github.com/FiloSottile/mkcert
import * as express from 'express'
import { readFileSync } from 'fs'
import { createServer } from 'https'
import { exec } from 'shelljs'

const REDIRECT_URL='https://example.test/'
const CLIENT_ID=process.env.CLIENT_ID
const CLIENT_SECRET=process.env.CLIENT_SECRET

let accessToken=''
let userId=''

var app = express()

app.get('/', function (req, res) {
  res.type('html');
  if(req.url.includes('?code=')) {
    // redirected from instagram auth window with the code param
    const code = req.url.substring( req.url.indexOf('?code=') + '?code='.length, req.url.length)
    const command = `
curl -X POST \
  https://api.instagram.com/oauth/access_token \
  -F client_id=${CLIENT_ID} \
  -F client_secret=${CLIENT_SECRET} \
  -F grant_type=authorization_code \
  -F redirect_uri=${REDIRECT_URL} \
  -F code=${code}
`.trim()
    const accessTokenResponse = curl(command)
    accessToken = accessTokenResponse.access_token
    userId = accessTokenResponse.user_id

    // console.log(exec(`curl -X GET \
    // 'https://graph.instagram.com/${userId}?fields=id,username&access_token=${accessToken}'`).stdout);
    
const listMediaCommand =`curl -X GET \
'https://graph.instagram.com/${userId}/media?fields=id,media_type,permalink,timestamp,username,thumbnail_url,media_url,caption&access_token=${accessToken}'`
console.log(listMediaCommand);

    res.send(`
    <p>Authorization code obtained: ${code}</p>
    <pre>${command}</pre>
    <div>
    Access token response: 
    <pre>${JSON.stringify(accessTokenResponse)}</pre>
    </div>
    <div>User info: 
      <pre>${curl(`curl -X GET \
    'https://graph.instagram.com/${userId}?fields=id,username&access_token=${accessToken}'`, 'formattedString')}</pre>
    </div>
    <div>User media: 
    <pre>${curl(listMediaCommand, 'formattedString')}</pre>
  </div>
    <a href="/listImages">List images</a>
    `)

    // console.log(`curl -X GET \
    // 'https://graph.instagram.com/${userId}/media?access_token=${accessToken}'`);
    
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

function curl(command: string, format: 'object'|'formattedString' = 'object') {
  const r = exec(command, {silent: true})
  const obj =  JSON.parse(r.stdout)
  if(format==='formattedString') {
    return JSON.stringify(obj, null, 2)
  }
  else {
    return obj
  }
}
