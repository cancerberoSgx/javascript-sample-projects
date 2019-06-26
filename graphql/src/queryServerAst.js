var { graphql, buildSchema, introspectionQuery, printSchema } = require('graphql');
var express = require('express');
var graphqlHTTP = require('express-graphql');

async function test() {

  // Construct a schema, using GraphQL schema language
  var schema = buildSchema(`
type Node {
  type: String
  text: String
  children: [Node]
  parent: Node!
  textIncludes(s: String): Boolean    
}
type Query {
  root: Node
}
`);

  class Node {
    constructor({ type, text, children, parent }) {
      this.type = type
      this.text = text || ''
      this.parent = parent
      this.children = children.map(c => new Node({...c, parent: this}))
    }
    textIncludes({s}) {
      console.log(s, this.text.includes(s))      
      return this.text.includes(s)
    }
  }

  // console.log(printSchema(schema));

  // The root provides a resolver function for each API endpoint
  var root = {
    root: new Node({
        type: 'Sourcefile',
        text: 'a',
        children: [
          {
            text: 'a', type: '  ', children: []
          },
          {
            text: 'a', type: 'InterfaceDeclaration', children: [
              { type: 'Identifier', text: 'Callable', children: [] },
            ]
          },

          {
            text: 'a', type: 'VariableDeclaration', children: []
          },

        ]
      })
      };
  // console.log(print));

  // Run the GraphQL query '{ hello }' and print out the response
  // const response = await graphql(schema, introspectionQuery, root)
  //   console.log(JSON.stringify(response, null, 2));

  var app = express();
  app.use('/graphql', graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  }));
  app.listen(4000);
  console.log('Running a GraphQL API server at http://localhost:4000/graphql');
}
test()