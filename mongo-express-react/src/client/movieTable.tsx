import { array } from 'misc-utils-of-mine-generic'
import React from 'react'
import { Form, Select, Table, Dimmer, Loader, Segment } from 'semantic-ui-react'
import { search } from './dispatch'
import Link from './link'
import { StoreComponent } from './store/storeComponent'
import './movieTable.css'
import SelectComponent from './selectComponent'
import { moviesGenres } from '../common/metadata'

export default class MovieTable extends StoreComponent {

  pageSizes = [
    { key: '5', value: '5', text: '5' },
    { key: '10', value: '10', text: '10' },
    { key: '20', value: '20', text: '20' },
  ]

  render() {

    if (this.state.search.loading) {
      return <Segment>
        <Dimmer active>
          <Loader>Loading</Loader>
        </Dimmer>
      </Segment>
    }
    const { totalPages, currentPage, pages } = this.getPages()
    return (
      <div>
        <div>
          <SelectComponent options={moviesGenres} onChange={e=>{
            console.log(e);
            search({ genres: e.selected.map(o=>o.value) })
          }}/>
        </div>
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
              <Table.Row>
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
              <Table.HeaderCell colSpan='2'>
                <Form>
                  <Form.Group inline>
                    <label>Movies per page</label>
                    <Select
                      options={this.pageSizes}
                      placeholder={this.state.search.limit + ''}
                      value={this.state.search.limit}
                      onChange={(e, data) => search({ limit: parseInt(data.value + '') })} />
                  </Form.Group>
                  <Form.Group inline>
                    <label>Pages</label>
                    <ul className="pages">
                      <li>
                        <Link action={() => search({ skip: 0 })}>first</Link>
                      </li>
                      {currentPage > 0 ? <li>
                        <Link action={() => search({ skip: (currentPage - 11) * this.state.search.limit })}>next</Link>
                      </li> : null}
                      {
                        pages.map(page =>
                          <li className={currentPage === page ? 'current' : ''}>
                            {currentPage === page ? <strong>**</strong> : null}
                            <Link action={() => search({ skip: page * this.state.search.limit })}>{page}</Link>
                          </li>)
                      }
                      {currentPage < totalPages ? <li>
                        <Link action={() => search({ skip: (currentPage + 1) * this.state.search.limit })}>next</Link>
                      </li> : null}
                      <li>
                        <Link action={() => search({ skip: totalPages - 1 })}>last</Link>
                      </li>
                    </ul>
                  </Form.Group>
                </Form>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>

      </div>
    )
  }

  getPages() {
    const totalPages = Math.trunc(this.state.search.total / this.state.search.limit)
    const currentPage = Math.trunc(this.state.search.skip / this.state.search.limit)
    const pages = [
      ...array(2).map(p => currentPage - p - 1).filter(p => p > 0 && p < totalPages),
      currentPage,
      ...array(2).map(p => currentPage + p + 1).filter(p => p > 0 && p < totalPages),
    ]
    return { totalPages, currentPage, pages }
  }
}