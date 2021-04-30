//@ts-nocheck
var tts = require('tts.js'); //require the module
async function test() {

const config = tts.loadConfig(__dirname+'/node_modules/tts.js/tts_config.json', async function(){
})
// console.log('a', config);
await sleep(100)

// console.log(__dirname+'/node_modules/tts.js/voices/es.json', 
  // require('fs').existsSync(__dirname+'/node_modules/tts.js/voices/es.json'))

  tts.loadVoice(__dirname+'/node_modules/tts.js/voices/es.json',async function(){
    var wav = tts.speak("Hola mundo", {
      amplitude: 100, //The amplitude
      wordgap: 30, //Gap between words
      pitch: 50, //The pitch of the speech
      speed: 155, //The speed
      voice: 'es' //The language of the text
    }, e=>{
      console.log('e');
      
    })
    
console.log(arguments, __dirname+'/node_modules/tts.js/tts_config.json');
await sleep(100)

console.log(arguments, wav);


    require('fs').writeFileSync('test.wav', wav)
    //Now wav contains a buffer containing the speech as a wave file.
  })
  console.log(__dirname+'/node_modules/tts.js/tts_config.json');
}

 function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

test()