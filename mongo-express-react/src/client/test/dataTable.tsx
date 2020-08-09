import React, { Component } from 'react'
import { Icon, Label, Pagination, PaginationProps, Table } from 'semantic-ui-react'

interface DataTableProps {

}
interface DataTableState<T> {
  activePage: number
  data: T[]
}

const defaultState: DataTableState<any> = {
  activePage: 1,
  data: []
}

export default class DataTableTest<T> extends Component<DataTableProps, DataTableState<T>> {
  constructor(p:any, s:any) {
    super(p, s)
    this.state = { ...defaultState, data: p.data }
    this.handlePaginationChange = this.handlePaginationChange.bind(this)
  }

  handleInputChange = (e:any, d:any) => this.setState({ activePage: d.value })

  handlePaginationChange(event: React.MouseEvent<HTMLAnchorElement>, data: PaginationProps) {
    this.setState({ activePage: parseInt(data.activePage + '') })
  }

  render() {
    const { activePage } = this.state

    return (
      <div>
        <Table celled>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Header</Table.HeaderCell>
              <Table.HeaderCell>Header</Table.HeaderCell>
              <Table.HeaderCell>Header</Table.HeaderCell>
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
                <Pagination
                  activePage={activePage}
                  onPageChange={this.handlePaginationChange}
                  ellipsisItem={{ content: <Icon name='ellipsis horizontal' />, icon: true }}
                  firstItem={{ content: <Icon name='angle double left' />, icon: true }}
                  lastItem={{ content: <Icon name='angle double right' />, icon: true }}
                  prevItem={{ content: <Icon name='angle left' />, icon: true }}
                  nextItem={{ content: <Icon name='angle right' />, icon: true }}
                  totalPages={10}
                />
                {/* <Menu floated='right' pagination>
            <Menu.Item as='a' icon>
              <Icon name='chevron left' />
            </Menu.Item>
            <Menu.Item as='a'>1</Menu.Item>
            <Menu.Item as='a'>2</Menu.Item>
            <Menu.Item as='a'>3</Menu.Item>
            <Menu.Item as='a'>4</Menu.Item>
            <Menu.Item as='a' icon>
              <Icon name='chevron right' />
            </Menu.Item>
          </Menu> */}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>

        {/* <Grid columns={2} verticalAlign='middle'>
          <Grid.Row>
            <Segment secondary>
              <div>activePage: {activePage}</div>
              <Input
                min={1}
                max={5}
                onChange={this.handleInputChange}
                type='range'
                value={activePage}
              />
            </Segment>
          </Grid.Row>
          <Grid.Row>
            <Pagination
              activePage={activePage}
              onPageChange={this.handlePaginationChange}
              ellipsisItem={{ content: <Icon name='ellipsis horizontal' />, icon: true }}
              firstItem={{ content: <Icon name='angle double left' />, icon: true }}
              lastItem={{ content: <Icon name='angle double right' />, icon: true }}
              prevItem={{ content: <Icon name='angle left' />, icon: true }}
              nextItem={{ content: <Icon name='angle right' />, icon: true }}
              totalPages={10}
            />
          </Grid.Row>
        </Grid> */}
      </div>
    )
  }
}