import { array, notFalsy } from 'misc-utils-of-mine-generic'
import React from 'react'
import { Form, Grid, Select } from 'semantic-ui-react'
import { search } from './dispatch'
import Link from './link'
import './searchPagination.css'
import { StoreComponent } from './store/storeComponent'

export default class SearchPagination extends StoreComponent {

  pageSizes = [
    { key: '5', value: '5', text: '5' },
    { key: '10', value: '10', text: '10' },
    { key: '20', value: '20', text: '20' },
    { key: '50', value: '50', text: '50' },
    { key: '100', value: '100', text: '100' },
  ]

  render() {

    const { totalPages, currentPage, pages } = this.getPages()

    return (
      <div>
        <Form>
          <Grid>
            <Grid.Row columns={3}>
              <Grid.Column>
                <Form.Group inline>
                  <label>Movies per page</label>
                  <Select
                    options={this.pageSizes}
                    placeholder={this.state.search.limit + ''}
                    value={this.state.search.limit}
                    onChange={(e, data) => search({ limit: parseInt(data.value + ''), skip: 0 })} />
                </Form.Group>
              </Grid.Column>

              <Grid.Column>
                <Form.Group inline>
                  <label>Pages</label>
                  <ul className="pages">
                    <li className={currentPage === 0 ? 'current-page' : ''} >
                      <Link action={() => search({ skip: 0 })}>0</Link>
                    </li>
                    <li>...</li>
                    {
                      pages.map(page =>
                        <li className={currentPage === page ? 'current-page' : ''}>
                          <Link action={() => search({ skip: page * this.state.search.limit })}>{page}</Link>
                        </li>)
                    }
                    <li>...</li>
                    <li className={currentPage === totalPages ? 'current-page' : ''} >
                      <Link action={() => search({ skip: (totalPages + 1) * this.state.search.limit })}>{totalPages + 1}</Link>
                    </li>
                  </ul>
                </Form.Group>
              </Grid.Column>

              <Grid.Column>
                <Form.Group inline>
                  <label>Select page</label>
                  <Select
                    defaultValue={currentPage}
                    options={array(totalPages + 1).map(i => ({ value: i, text: i, key: i }))}
                    onChange={(e, d) => {
                      search({ skip: parseInt(d.value + '') * this.state.search.limit })
                    }} />
                </Form.Group>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Form>
      </div>
    )
  }

  getPages(step = 3) {
    const totalPages = Math.trunc(this.state.search.total / this.state.search.limit)
    const currentPage = Math.trunc(this.state.search.skip / this.state.search.limit)
    const pages = [
      ...array(step).map(p => currentPage - p - 1).filter(p => p > 1 && p < totalPages),
      currentPage > 0 && currentPage < totalPages ? currentPage : undefined,
      ...array(step).map(p => currentPage + p + 1).filter(p => p > 0 && p <= totalPages),
    ].filter(notFalsy).sort((a, b) => a > b ? 1 : -1)
    return { totalPages, currentPage, pages }
  }
}