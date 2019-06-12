//@ts-nocheck
const config =  require('../tts.js/tts_config.json')
const es = require('../tts.js/voices/es.json')
require('babel-polyfill')
var tts = require('../tts.js'); 

async function test() {
 tts.loadConfig(JSON.stringify(config))
await sleep(100)

  tts.loadVoice(JSON.stringify(es),async function(){
    var wav = tts.speak("Hola mundo", {
      amplitude: 100, //The amplitude
      wordgap: 30, //Gap between words
      pitch: 50, //The pitch of the speech
      speed: 155, //The speed
      voice: 'es' //The language of the text
    })
await sleep(100)
const audio = document.createElement('audio')
audio.setAttribute('controls', '')
audio.src = `data:audio/wav;base64,${wav.toString('base64')}`
document.body.appendChild(audio)
  })
}

 function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

test()
