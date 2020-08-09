import React, { Component } from 'react'
import { Icon, Label, Pagination, PaginationProps, Table } from 'semantic-ui-react'
import { StoreComponent } from './store/storeComponent'
import { getStore } from './store/store'


export default class MovieTable extends StoreComponent {
  columns = ['title', 'description']
  render() {
    return (
      <div>
        <Table celled>
          <Table.Header>
            <Table.Row>
              {this.columns.map(c => <Table.HeaderCell>{c}</Table.HeaderCell>)}
            </Table.Row>
          </Table.Header>

          <Table.Body>
            <Table.Row>
              <Table.Cell>
                <Label ribbon>First</Label>
              </Table.Cell>
              <Table.Cell>Cell</Table.Cell>
              <Table.Cell>Cell</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Cell</Table.Cell>
              <Table.Cell>Cell</Table.Cell>
              <Table.Cell>Cell</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Cell</Table.Cell>
              <Table.Cell>Cell</Table.Cell>
              <Table.Cell>Cell</Table.Cell>
            </Table.Row>
          </Table.Body>

          <Table.Footer>
            <Table.Row>
              <Table.HeaderCell colSpan='3'>
                {/* <Pagination
                  activePage={activePage}
                  onPageChange={this.handlePaginationChange}
                  ellipsisItem={{ content: <Icon name='ellipsis horizontal' />, icon: true }}
                  firstItem={{ content: <Icon name='angle double left' />, icon: true }}
                  lastItem={{ content: <Icon name='angle double right' />, icon: true }}
                  prevItem={{ content: <Icon name='angle left' />, icon: true }}
                  nextItem={{ content: <Icon name='angle right' />, icon: true }}
                  totalPages={10} 
                />*/}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>

      </div>
    )
  }
  // handleInputChange = (e: any, d: any) => this.setState({ activePage: d.value })

}