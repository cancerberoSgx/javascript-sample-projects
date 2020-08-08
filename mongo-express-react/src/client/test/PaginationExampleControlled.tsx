import React, { Component } from 'react'
import { Grid, Input, Pagination, Segment, PaginationProps, Icon } from 'semantic-ui-react'
import { array } from 'misc-utils-of-mine-generic'

export default class PaginationExampleControlled extends Component {
  state = { activePage: 1 }
  
  constructor(p,s){
    super(p,s)
    this.handlePaginationChange = this.handlePaginationChange.bind(this)
  }

  handleInputChange = (e, { value }) => this.setState({ activePage: value })

  handlePaginationChange(event: React.MouseEvent<HTMLAnchorElement>, data: PaginationProps) {
    this.setState({ activePage: data.activePage })
  }
// 
  // data = array(10).map(i=>{a: i})

  render() {
    const { activePage } = this.state

    return (
      <Grid columns={2} verticalAlign='middle'>
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
      </Grid>
    )
  }
}