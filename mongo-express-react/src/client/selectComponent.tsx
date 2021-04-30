import React, { Component } from 'react'
import { Dropdown, DropdownProps } from 'semantic-ui-react'

export interface SelectComponentOption { 
  text: string
  value: string 
  selected?: boolean
}

export interface SelectComponentProps {
  options: string[] | SelectComponentOption[]
  onChange: (e: E) => void
  placeholder?: string
}
interface E{
  options: SelectComponentOption[]
  selected: SelectComponentOption[]
}

export default class SelectComponent extends Component<SelectComponentProps> {

  render() {
    const options = this.getOptions()
    return (
      <Dropdown
        multiple
        selection
        fluid
        onChange={(e,d)=>this.onChange(e,d)}
        options={options}
        placeholder={this.props.placeholder||'Select some options'}
        defaultValue={options.filter(o=>o.selected).map(o=>o.value) as any}
      />
    )
  }

  getOptions(){
    let normalizedOptions = typeof this.props.options[0]==='string' ? (this.props.options as string[]).map(o=>({text: o, value: o, selected: false})) : this.props.options as SelectComponentOption[]
    const options = normalizedOptions.map(o=>({key: o.value, text: o.text, value: o.value, selected: o.selected}))
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
