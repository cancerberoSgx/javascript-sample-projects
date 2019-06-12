import { Component, render } from 'inferno'
import { createElement } from 'inferno-create-element'
import { editable, element, generateForm2, label } from '../forms'
import { createHTMLAudioElement } from '../html'
import { defaultOptions, Options, speak } from '../speak'

class OptionsImpl implements Options {
  constructor(o: Options) {
    this.words = o.words
    this.amplitude = o.amplitude || defaultOptions.amplitude
    this.wordgap = o.wordgap || defaultOptions.wordgap
    this.pitch = o.pitch || defaultOptions.pitch
    this.voice = o.voice || defaultOptions.voice
    this.speed = o.speed || defaultOptions.speed
  }

  @element('textarea')
  @label('Words to speak')
  @editable
  words: string = 'hola Mundo'

  @editable
  @label('Volume')
  amplitude: number = 100

  @label('Word Gap')
  @editable
  wordgap: number = 10

  @label('Pitch')
  @editable
  pitch: number = 55

  @label('Speed')
  @editable
  speed: number = 175

  voice: string = 'es'
}

class MyComponent extends Component<{}, Options> {
  state = new OptionsImpl(defaultOptions)
  audioContainer: HTMLDivElement | undefined
  render() {
    return (
      <div>
        <div ref={(c: HTMLDivElement) => { this.audioContainer = c; this.update() }}></div>
        <ul>{generateForm2(new OptionsImpl(this.state), value => {
          this.setState(value.data)
          this.update()
        }).map(e => <li>{e}</li>)}</ul>
      </div>
    )
  }
  async update() {
    const wav = await speak(this.state)
    const audio = createHTMLAudioElement(wav)
    this.audioContainer!.innerHTML = ''
    this.audioContainer!.appendChild(audio)
  }
}


render(<MyComponent />, document.body)
