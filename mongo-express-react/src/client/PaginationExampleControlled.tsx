import React, { Component } from 'react'
import { Grid, Input, Pagination, Segment, PaginationProps } from 'semantic-ui-react'

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

  render() {
    const { activePage } = this.state

    return (
      <Grid columns={2} verticalAlign='middle'>
        <Grid.Column>
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
        </Grid.Column>
        <Grid.Column>
          <Pagination
            activePage={activePage}
            onPageChange={this.handlePaginationChange}
            totalPages={5}
          />
        </Grid.Column>
      </Grid>
    )
  }
}