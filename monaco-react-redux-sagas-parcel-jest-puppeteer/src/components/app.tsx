import * as React from 'react'
import { State } from '../store/types'
import { EditorExplorerBody } from './editorExplorerBody'
import { Header } from './header'
import { Provider, connect } from 'react-redux'
import { Store } from 'redux';
import { dispatch } from '../store/store';
import { THEME_ACTIONS } from '../store/theme';
import { allThemes } from '../style/theme';
import { Styles } from '../style/styles';

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
