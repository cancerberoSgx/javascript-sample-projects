var { graphql, buildSchema, introspectionQuery, printSchema } = require('graphql');

async function test() {

// Construct a schema, using GraphQL schema language
var schema = buildSchema(`
type Node {
  type: String,
  text: String,
  children: [Node],
  textIncludes(s: String): Boolean
}
type Query {
  getRoot(): Node
}
`);

class  Node {
  constructor(  {type, text='',   children}){
    this.type=type
    this.text = text||''
    this.children = children.map(c=>new Node(c))
  }
  textIncludes(s) {
    return this.text.includes(s)
  }
}

console.log(printSchema(schema));

// The root provides a resolver function for each API endpoint
var root = {
  getRoot(){
    return new Node({
      type : 'Sourcefile',
      children: [
        {type: 'VariableDeclaration', children: []},
        {type: 'InterfaceDeclaration', children: [
          {type: 'Identifier', text: 'Callable', children: []},    
        ]},
    
        {type: 'VariableDeclaration', children: []},
    
      ]
    })
  }
 
};
// console.log(print));

// Run the GraphQL query '{ hello }' and print out the response
const response = await graphql(schema, introspectionQuery, root)
  console.log(JSON.stringify(response, null, 2));
}
test()