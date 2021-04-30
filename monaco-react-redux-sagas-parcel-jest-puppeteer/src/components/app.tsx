import * as React from 'react';
import { connect } from 'react-redux';
import { State } from '../store/types';
import { Styles } from '../style/styles';
import { EditorExplorerBody } from './editorExplorerBody';
import { Header } from './header';

interface P {
}

class App_ extends React.Component<P, {}> {
  render() {
      return <section className="section">
       <Styles  />
        <Header  />
        <EditorExplorerBody  />
      </section>
  }
}

const mapStateToProps = (state: State) => ({
})

export const App = connect<{}>(
  mapStateToProps
)(App_) 
