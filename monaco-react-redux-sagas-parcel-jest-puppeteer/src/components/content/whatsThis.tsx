import * as React from 'react'

export const WhatsThis = (props: {}) => <article className="content">
  <h1>JSX Explorer</h1>

  <p>Allow to write JSX code (TypeScript or JavaScript) in an awesome editor, parse it and then show its structure in  different ways: </p>

  <ul>

    <li><strong>Elements Explorer</strong> shows the result of render the JSX expression returned by the code. The resulting HTML is represented as a tree of nodes (like JS.Element / <code>React.createElement()</code> internal structure) and also shows the result HTML  or similar call. </li>

    <li><strong>JSX AST Explorer</strong> shows the abstract syntax tree of the code, letting get details of each node, and following the editor cursor position and viceversa.  </li>

    <li><strong>JSX Colors</strong> let users explore a gallery of different JSX Syntax Highlight skins andalso create / edit its own. Differently than the other explorers, instead of representing JSX or its output as a tree of nodes, it tries to do so with a visual structure of "colored" code-parts. Is very flexible, exposes a lot of JSx kind of nodes and it's based on CSS selectors so hope you have fun and go crazy with it!</li>
  </ul>

  <p>Initially this project was just a test to see how easy and viable was to build a real world react-like application using <a href="https://github.com/cancerberoSgx/jsx-alone">JSXAlone</a>. Now JSX-alone is only used in the backend (webworker) to render or parse JSX code but not in the front-end of this app. </p>

  <p>This application is not since it loads a bunch of libraries like:</p>

    <ul>
      <li>TypeScript compiler</li>
      <li>ts-simple-ast</li>
      <li>monaco-editor</li>
      <li>react</li>
      <li>redux</li>
      <li>redux-sagas</li>
      <li>bulma.css</li>
    </ul>

</article>
