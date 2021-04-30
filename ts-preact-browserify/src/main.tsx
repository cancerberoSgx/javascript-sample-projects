// import * as React from 'react'

export const test1 = (c: {name: string})=> <div>{c.name}</div>

import { h, render } from 'preact';
import { Clock } from './clock';

render((
	<div id="foo">
		<span>Hello, world!</span>
		<button onClick={ e => alert("hi!") }>Click Me</button>
	 { test1({name: 'seba22'})}
	 <Clock lapse={1000}/>
	</div>
), document.body);

