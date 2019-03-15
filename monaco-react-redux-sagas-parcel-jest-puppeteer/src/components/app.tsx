import * as React from 'react';
import { connect } from 'react-redux';
import { State } from '../store/types';
import { Styles } from '../style/styles';
import { EditorExplorerBody } from './editorExplorerBody';
import { Header } from './header';

interface P {
  state: State,
}

class App_ extends React.Component<P, {}> {
  render() {
      return <section className="section">
       <Styles theme={this.props.state.layout.theme} />
        <Header state={this.props.state} />
        <EditorExplorerBody state={this.props.state}  />
      </section>
  }
}

const mapStateToProps = (state: State) => ({
  state: state
})

export const App = connect<{state:State}>(
  mapStateToProps
)(App_) as any as typeof App_
