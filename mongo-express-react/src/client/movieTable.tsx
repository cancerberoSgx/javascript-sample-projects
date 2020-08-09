import React from 'react'
import { Label, Table } from 'semantic-ui-react'
import { StoreComponent } from './store/storeComponent'

export default class MovieTable extends StoreComponent {
  // columns = ['title', 'description']
  render() {
    if(this.state.search.loading){
      return <div>Loading...</div>
    }
    return (
      <div>
        <Table celled>
          <Table.Header>
            <Table.Row>
              {/* {this.columns.map(c => <Table.HeaderCell>{c}</Table.HeaderCell>)} */}
              <Table.HeaderCell>Title</Table.HeaderCell>
              <Table.HeaderCell>Description</Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {this.state.search.results.map(movie=>
             <Table.Row>
             <Table.Cell>{movie.title}</Table.Cell>
             <Table.Cell>{movie.description_full}</Table.Cell>
           </Table.Row>
              )}
          </Table.Body>

          <Table.Footer>
            <Table.Row>
              <Table.HeaderCell colSpan='3'>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>

      </div>
    )
  }
}