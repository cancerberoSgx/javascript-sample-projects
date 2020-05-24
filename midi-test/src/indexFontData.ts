import { webAudioFontData } from './fontdata'
import { append, loadJSONPreset } from './util';
import { notSameNotFalsy } from 'misc-utils-of-mine-generic';
import { IWebAudioFontPlayer, Preset, Player } from './WebAudioFontPlayer';

async function main() {
  let selected = webAudioFontData[0]
  let selectedImplementation = selected.files[0]
  // let selectedInstrument = selected.name
  // let category = selected.category
  let categories = webAudioFontData.map(c => c.category).filter(notSameNotFalsy)
  // let instruments = webAudioFontData.filter(c => c.category === selected.category).map(c => c.name)
  function renderInstruments() {
    return webAudioFontData
      .filter(c => c.category === selected.category)
      .map(c => c.name)
      .map(c => `<option ${selected.name === c ? 'selected' : ''} value="${c}">${c}</option>`).join('')
  }
  function renderImplementations() {
    return selected.files.map(f => `<option ${selectedImplementation === f ? 'selected' : ''} value="${f}">${f}</option>`).join('')
  }
  const container = append(`
    <label>
      Category
      <select class="category">
      ${categories.map(c => `<option value="${c}">${c}</option>`)}
      </select>
    </label>
    <label>
      Instrument
      <select class="instrument">
      ${renderInstruments()}
      </select>
    </label>
    <label>
      Implementation
      <select class="implementation">
      ${renderImplementations()}
      </select>
    </label>
    <button class="play">play</button>
  `)
  container.querySelector('.category').addEventListener('change', e => {
    selected = webAudioFontData.find(d => d.category === (e.target as HTMLSelectElement).value)
    container.querySelector('.instrument').innerHTML = renderInstruments()
    container.querySelector('.implementation').innerHTML = renderImplementations()
  })
  container.querySelector('.instrument').addEventListener('change', e => {
    selected = webAudioFontData.find(d => d.category === selected.category && d.name === (e.target as HTMLSelectElement).value)
    container.querySelector('.implementation').innerHTML = renderImplementations()
  })
  container.querySelector('.implementation').addEventListener('change', e => {
    selectedImplementation = (e.target as HTMLSelectElement).value
  })
  container.querySelector('.play').addEventListener('click', async e => {
    preset = await loadPreset()
    if(!audioContext){
      audioContext = new AudioContext();
      player = new Player();
    }
    player.cancelQueue(audioContext)
    player.queueWaveTable(audioContext, audioContext.destination, preset, 0, 88, 0.3, 0.5);
    player.queueWaveTable(audioContext, audioContext.destination, preset, 0.5, 68, 0.3, 0.5);
    player.queueWaveTable(audioContext, audioContext.destination, preset, 1, 48, 0.3, 0.5);
  })

  const presets = {}
  async function loadPreset() {
    if (!presets[selectedImplementation]) {
      presets[selectedImplementation] = await loadJSONPreset(`tmp/${selectedImplementation}.json`)
    }
    return presets[selectedImplementation]
  }

  let player: IWebAudioFontPlayer
  let audioContext: AudioContext
  let preset: Preset
  // preset = await loadPreset()
  

}

main()
