import { registerStyle } from '../../../style/styles';
import { Component } from '../../util/component';
import * as React from 'react'
import { JsxColorsState, JsxColorsTools } from "./jsxColorsTypes";
import { showInModal } from '../../util/showInModal';
import { Help } from './jsxColorsHelp';
import { JSX_COLORS_ACTIONS } from '../../../store/jsxColors';
import { JsxColorSkins } from './JsxColorSkins';
import { dispatch } from '../../../store/store';
import { JsxColorsEditor } from './JsxColorsSkinEditor';
import { CompiledExplorerOptions, State } from '../../../store/types';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import { OPTIONS_ACTIONS } from '../../../store/options';

registerStyle(`
`);

interface P extends JsxColorsState {
  options?: CompiledExplorerOptions
  // onSelectCode?(sel: SelectCode): void
  // onSelectCode: typeof onSelectCode
}
interface S {

}
class JsxColorsMain_ extends Component<P, S> {
  render() {
    if (this.props.options &&this.props.options.disableJSXSyntaxHighlight) {
      return <div className="content">
        <h3>Disabled</h3>
        <p>By configuration, disableJSXSyntaxHighlight option is turned on so I'm disabled. </p>
      </div>
    } 
    return <div className="JsxColorsMain">
      <h3>JSX syntax highlight editor</h3>

      <p>Welcome! Use the menu below to learn how to use it, experiment existing JSx syntax themes and finally make your own!</p>

      <div className="tabs is-small is-boxed is-toggle editorExplorerOptions">
        <ul>
          <li className={`help`}>
            <a onClick={e => showInModal(<Help></Help>, 'JSX Syntax Highlight gallery and Editor')}>Help</a>
          </li>}
        <li className={`skins ${!this.props.selected ? 'is-active' : ''}`}>
            <a onClick={e => this.selectTab('skins')}>Skins</a>
          </li>
          <li className={`editor ${this.props.selected ? 'is-active' : ''}`} >
            <a onClick={e => this.selectTab('editor')}>editor your own</a>
          </li>
        </ul>
      </div>

      <div className={`editorExplorerBody`}>
        <div className={`editorExplorerBodyOverlay`}>Working...</div>
        <div className={`editor editorExplorerBodyMember ${!this.props.selected ? 'is-active' : ''}`}>
          <JsxColorSkins {...this.props} />
        </div>
        <div className={`editorExplorerBodyMember jsxColorsEditor ${this.props.selected ? 'is-active' : ''}`}>
          <JsxColorsEditor {...this.props} />
        </div>
      </div>
    </div>
  }
  selectTab(tool: JsxColorsTools) {
    dispatch({ type: JSX_COLORS_ACTIONS.CHANGE_TOOL, payload: { tool } })
  }

}

export const JsxColorsMain = connect (
  (state: State) => ({
    predefined: state.jsxColors.predefined,
    compilerOption: state.compiled.explorer,
    selectedSkinCurrentStyles: state.jsxColors.selectedSkinCurrentStyles,
    selected: state.jsxColors.selected,
  })
)(JsxColorsMain_) 


// const mapStateToProps = ({ listRecordTypes }: ApplicationState) => ({
//   pageSize: listRecordTypes.pageSize,
//   type: listRecordTypes.type,
//   results: listRecordTypes.results,
//   loading: listRecordTypes.loading,
//   recordTypes: listRecordTypes.recordTypes,
//   error: listRecordTypes.error,
//   resultColumns: listRecordTypes.resultColumns
// })


// const mapDispatchToProps = (dispatch: Dispatch) => ({
//   fetchRecord: (c: FetchRecordOptions) => dispatch(fetchRecord(c))
// })export const showRecord = (results: ShowRecordOptions) => { return action(RecordViewActionTypes.SHOW, results) }

// export const onSelectCode = (sel: SelectCode)=> {return {type: OPTIONS_ACTIONS.PUSH_LOG,payload: {}}}
//   onSelectCode: (sel: SelectCode)=> dispatch(onSelectCode(sel))
// // });


// predefined: JsxSyntaxSkin[];
// selected?: JsxSyntaxSkin;
// selectedSkinCurrentStyles?: JsxColorsSkinStyles
// options?: CompiledExplorerOptions
