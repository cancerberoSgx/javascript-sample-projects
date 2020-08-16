import { array } from 'misc-utils-of-mine-generic'
import React from 'react'
import { Form } from 'semantic-ui-react'
import { moviesGenres } from '../common/metadata'
import { search } from './dispatch'
import './movieTable.css'
import SelectComponent, { SelectComponentOption } from './selectComponent'
import { StoreComponent } from './store/storeComponent'

export default class SearchFilters extends StoreComponent {

  render() {
    const genres: SelectComponentOption[] = moviesGenres.map(o => ({ value: o, text: o, selected: this.state.search.genres.includes(o) }))
    return (
      <div>
        <Form>
          <Form.Group inline>
            <label>Genres</label>
            <SelectComponent options={genres} placeholder="All genres"
              onChange={e => search({ genres: e.selected.map(o => o.value) })} />
          </Form.Group>
        </Form>
        <div><strong>Total: </strong>{this.state.search.total}</div>
      </div>
    )
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