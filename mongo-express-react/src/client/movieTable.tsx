import { array, printMs } from 'misc-utils-of-mine-generic'
import React from 'react'
import { Dimmer, Loader, Segment, Table } from 'semantic-ui-react'
import Link from './link'
import './movieTable.css'
import SearchFilters from './searchFilters'
import SearchPagination from './searchPagination'
import { StoreComponent } from './store/storeComponent'

export default class MovieTable extends StoreComponent {

  render() {
  const t0 = Date.now()
   
    if (this.state.search.loading) {
      return <div>
        <SearchFilters />
        <Dimmer active>
          <Loader>Loading</Loader>
        </Dimmer>
      </div>
    }

    const result = <div>
      <Segment>
        <SearchFilters />
      </Segment>
      <Segment>
        <SearchPagination />
      </Segment>
      <Segment>
        <Table celled>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Title</Table.HeaderCell>
              <Table.HeaderCell>Description</Table.HeaderCell>
              <Table.HeaderCell>Year</Table.HeaderCell>
              <Table.HeaderCell>Files</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
  
          <Table.Body>
            {this.state.search.results.map(movie =>
              <Table.Row key={movie.id}>
                <Table.Cell><Link href={`movie/${movie.id}`}>{movie.title}</Link></Table.Cell>
                <Table.Cell>{movie.description_full}</Table.Cell>
                <Table.Cell>{movie.year}</Table.Cell>
                <Table.Cell>
                  <p>Files</p>
                  <ul>
                    {movie.torrents.map(t => <li><a href={t.url}>{t.size}</a></li>)}
                  </ul>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
  
          <Table.Footer>
            <Table.Row>
              <Table.HeaderCell colSpan='4'>
                <SearchPagination />
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>
      </Segment>

    </div>

console.log(printMs(Date.now()-t0));

              
    return result

  }

  getPages(step = 3) {
    const totalPages = Math.trunc(this.state.search.total / this.state.search.limit)
    const currentPage = Math.trunc(this.state.search.skip / this.state.search.limit)
    const pages = [
      ...array(step).map(p => currentPage - p - 1).filter(p => p > 1 && p < totalPages),
      currentPage,
      ...array(step).map(p => currentPage + p + 1).filter(p => p > 0 && p < totalPages),
    ]
    return { totalPages, currentPage, pages }
  }
}