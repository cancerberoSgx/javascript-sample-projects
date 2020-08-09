import React from 'react'
import { Container } from 'semantic-ui-react'
import Link from './link'
import MovieTable from './movieTable'
import { StoreComponent } from './store/storeComponent'
import TestComponent from './testComponent'

export default class MainComponent extends StoreComponent {
  render() {
    return (
      <Container>
      <nav>
        <ul>
          <li>
            <Link href="/search">Search</Link>
          </li>
          <li>
          <Link href="/test">Test</Link>
          </li>
        </ul>
      </nav>
      {this.state.page==='search' ? <MovieTable></MovieTable> : null}
      {this.state.page==='test' ? <TestComponent></TestComponent> : null}
    </Container>
    )
  }
}
