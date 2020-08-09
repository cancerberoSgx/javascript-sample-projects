import React from 'react'
import { Label, Table, Select } from 'semantic-ui-react'
import { StoreComponent } from './store/storeComponent'
import { setState, getState } from './store/store'
import { search } from './dispatch'

export default class MovieTable extends StoreComponent {
  // columns = ['title', 'description']

  
  render() {
    const options = [
      { key: '5', value: '5', text: '5' },
      { key: '10', value: '10', text: '10' },
      { key: '20', value: '20', text: '20' },
    ]
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
              <Table.HeaderCell colSpan='2'>
                <Select options={options} placeholder={this.state.search.limit+''} value={this.state.search.limit} 
                onChange={async (e, data)=>{
                  await search({limit: parseInt( data.value+'')})
                  // console.log(data.value);
                  // const s=getState()
                  // s.search.limit =parseInt( data.value+'')
                  // setState(s)                  
                }}/>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>

      </div>
    )
  }
}