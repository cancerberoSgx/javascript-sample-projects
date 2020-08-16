import React, { Component } from 'react'
import { Dropdown, DropdownProps } from 'semantic-ui-react'

interface Option { 
  text: string
  value: string 
}

interface P {
  options: string[] | Option[]
  onChange: (e: E) => void
}
interface E{
  options: Option[]
  selected: Option[]
}

export default class SelectComponent extends Component<P> {

  render() {
    return (
      <Dropdown
        multiple
        selection
        fluid
        onChange={(e,d)=>this.onChange(e,d)}
        options={this.getOptions()}
        placeholder='Choose an option'
      />
    )
  }

  getOptions(){
    let normalizedOptions = typeof this.props.options[0]==='string' ? (this.props.options as string[]).map(o=>({text: o, value: o})) : this.props.options as Option[]
    const options = normalizedOptions.map(o=>({key: o.value, text: o.text, value: o.value}))
    return options
  }

  onChange(e: React.SyntheticEvent<HTMLElement, Event>, d: DropdownProps): void {
    const options = this.getOptions()
    const event = {
      options,
      selected: options.filter(o=>(d.value as string[]).includes(o.value))
    }
    this.props.onChange(event)
  }
}
