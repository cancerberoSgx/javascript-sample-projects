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
  store: Store
}

export class App extends React.Component<P, {}> {
  render() {

// setTimeout(() => {
//   debugger
//   dispatch({type: THEME_ACTIONS.CHANGE_THEME, theme: allThemes[0]})
// }, 1000);

    return <Provider store={this.props.store}>
      <section className="section">
       <Styles theme={this.props.state.layout.theme} />
        <Header state={this.props.state} />
        <EditorExplorerBody state={this.props.state}  />
      </section>
    </Provider>
  }
}

const mapStateToProps = (state: State) => ({
  state: state
})

export default connect<{state:State}>(
  mapStateToProps
)(App)
