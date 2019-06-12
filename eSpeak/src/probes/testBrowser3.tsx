import { speak, Options, defaultOptions } from '../speak';
import { createElement } from 'inferno-create-element';
import { render, Component } from 'inferno';
import { createHTMLAudioElement } from '../html';
import { editable,  generateForm2, element, label } from '../forms';

class OptionsImpl implements Options {
  constructor(o: Options){
    this.words=o.words
    this.amplitude=o.amplitude||defaultOptions.amplitude
    this.wordgap=o.wordgap||defaultOptions.wordgap
    this.pitch=o.pitch||defaultOptions.pitch
    this.voice=o.voice||defaultOptions.voice
    this.speed=o.speed||defaultOptions.speed
  }

  @element('textarea')
  @label('Words to speak')
  @editable
  words: string='hola Mundo'

  @editable
  @label('Volume')
  amplitude: number=100

  @label('Word Gap')
  @editable  
  wordgap: number= 10

  @label('Pitch')
  @editable  
  pitch: number=55

  @label('Speed')
  @editable  
  speed: number=175

  voice: string='es'
}

class MyComponent extends Component<{}, Options> {
  state= new OptionsImpl(defaultOptions)
  audioContainer: HTMLDivElement|undefined
  render() {
    return (
      <div>
        {/* <h1>Header!</h1> */}
        {/* <span>Counter is at: { this.state.counter }</span> */}
        {/* <button onClick={e=>this.setState({counter: this.state.counter + 1})}>click me</button> */}
        {/* <textarea onChange={e=>this.setState({words: e.currentTarget.value})}>{this.state.words}</textarea> */}
        {/* <button onClick={e=>this.update()}>update</button> */}
        <div ref={(c: HTMLDivElement)=>this.audioContainer = c}></div>
        {/* <div ref={(c:HTMLDivElement)=> generateForm(new OptionsImpl(), c)}></div> */}
        <ul>{generateForm2(new OptionsImpl(this.state ), value=>{
          this.setState(value.data)
          this.update()
        }).map(e=><li>{e}</li>)}</ul>
      </div>
    );
  }
  async update() {   
    const wav = await speak(this.state)
    const audio = createHTMLAudioElement(wav)
    this.audioContainer!.innerHTML = ''
    this.audioContainer!.appendChild(audio) 
}
  }


render(  <MyComponent />,  document.body)