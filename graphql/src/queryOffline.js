var { graphql, buildSchema } = require('graphql');

async function test() {

// Construct a schema, using GraphQL schema language
var schema = buildSchema(`
  type Query {
    hello: String
  }
`);

// The root provides a resolver function for each API endpoint
var root = {
  hello: () => {
    return 'Hello world!';
  },
};

// Run the GraphQL query '{ hello }' and print out the response
const response = await graphql(schema, '{ hello }', root)
  console.log(response);
}
test()