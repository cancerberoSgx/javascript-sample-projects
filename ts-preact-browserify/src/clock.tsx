import { h, render, Component } from 'preact';
interface Props{
  lapse: number
}
interface State{
  time: Date
}
export class Clock extends Component<Props, State> {
  timer: number
  // state: 
	constructor() {
		super();
		// set initial time:
		this.state = {
			time: new Date()
		};
	}

	componentDidMount() {
		// update time every second
		this.timer = setInterval(() => {
			this.setState({ time: new Date() });
		}, this.props.lapse);
	}

	componentWillUnmount() {
		// stop when not renderable
		clearInterval(this.timer);
	}

	render(props: Props, state: State) {
		let time = new Date(state.time).toLocaleTimeString();
		return <span>{ time }</span>;
	}
}

// render an instance of Clock into <body>:
// render(<Clock lapse={1000}/>, document.body);