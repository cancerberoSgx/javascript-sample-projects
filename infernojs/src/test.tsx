import * as React from 'react';
import {  render } from 'react-dom';

interface P {}
interface S{
  counter: number
}
class MyComponent extends React.Component<P, S> {
  state: S
  constructor(props) {
    super(props);
    this.state = {
      counter: 0,
      ...props
    };
  }
  render() {
    return (
      <div>
        <h1>Header!</h1>
        <span>Counter is at: { this.state.counter }</span>
      </div>
    );
  }
}


const el = document.createElement('div')
document.body.append(el)
render(
  <MyComponent />,
  el
);