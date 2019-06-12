const config = require('../tts.js/tts_config.json')
const es = require('../tts.js/voices/es.json')
require('babel-polyfill')
var tts = require('../tts.js');

let configLoaded = false

export async function speak(o: Options): Promise<Buffer> {
  o = { ...defaultOptions, ...o }

  if (!configLoaded) {
    tts.loadConfig(JSON.stringify(config))
    await sleep(100)
    configLoaded = true
  }
  return new Promise(resolve => {
    tts.loadVoice(JSON.stringify(es), function () {
      var wav = tts.speak(preprocessWords(o), o)
      resolve(wav)
    })
  })
}

export interface Options {
  words: string,
  amplitude?: number, //The amplitude
  wordgap?: number, //Gap between words
  pitch?: number, //The pitch of the speech
  speed?: number, //The speed
  voice?: string //The language of the text
}

export const defaultOptions: Required<Options> = {
  words: 'Hola Mundo',
  amplitude: 100, 
  wordgap: 10,
  pitch: 50, 
  speed: 175, 
  voice: 'es' 
}

function preprocessWords(o: Options): any {
  return o.words.replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'ni');
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}