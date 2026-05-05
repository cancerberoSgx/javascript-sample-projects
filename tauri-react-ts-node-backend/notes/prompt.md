This is a tauri desktop app built with typescript and react
I want to build a sql inspector, initially for postgres but also for other dbs in the future such as mysql, sqlite, etc

But instead of using the rust backend, I want to use a node.js backend, assuming node.js is installed on the system. On my side I want to have my own node.js backend project folder here with its own package.json so I can manage the many dependencies such as sql drivers, dev dependencies like typescript, etc

how  would you recommend me to implement this ? calling node each time and running compiled scripts for each backend operation ? 
or should I implement an http server which listens for operations as rest endpoints ? 

Or any other kind of ipc communication ? 

Just write your suggestions, don't write any code 



---
 
Implement your recommendation with this extra work:
                                                           
Recommendation
            
Go with the HTTP server approach. The workflow becomes:                                                                                                                                                                           
- node-backend/ is a standalone Node.js project (its own package.json, TypeScript, pg/mysql2/better-sqlite3, etc.)      
- The Rust side spawns it, waits for a "ready" signal (e.g. the process prints the port to stdout), then exposes that port to the frontend via a Tauri command                      
- The React frontend talks directly to http://127.0.0.1:{port} — Rust is just a process manager                                                                                     
- A random startup token in a request header is enough to prevent other local processes from hitting it                                                        

Extra:

 * node-backend must use express as server and typescript                                                            
 * make sure the first time the app starts (if there's no node-backend/node_modules) it must call "npm install" before running the server
 * For now just implement a GET /api/health endpoint that returns {success: true} and in the frontend call it and render the response in the UI
                                                                                                                                                         

p2:

when executing "npm run tauri dev" the app opens and but I'm seeing Error: Type error: Load failed. If I enter with the browser I see "Error: TypeError: Cannot read properties of undefined (reading 'invoke')"
I'm not seeing any logs on the server startup in the console
I've verified that running the server manually works fine and is printing the port and auth token correctly (npm install executed correctly automatically)

p3
when the app 


# backend-db

The backend will use a sqlite db to store user's data between sections
the schema will be defined in migrations and we will always write pure sql both for migrations and for queries
migrations wil be run on startup so I can modify the schema and these changes will be applied on next execution.
the sqlite db file must be created and read from $HOME/.my_db_inspector/data
Make sure to use a pure JavaScript library to access sqlite - we don't want to assume user must have python or other build tools to install dependencies, only node.js 
Create a first migration that creates a table connections with following columns:
 * id int PK
 * name text
 * db_host text
 * db_port int
 * db_name text
 * db_user text
 * db_password text


# connection endpoints

the backend has the following endpoints

GET /api/connections (list all connections)
POST /api/connections create new connection
PUT /api/connections/{id}  edit a connection

Implement data layer in src/repository/connectionRepository.ts which uses pure sql
implement the connections api middleware in src/api/connections.ts which will call the repository to access the data



# tauri dev in browser

is it possible to debug this tauri app (react frontend) using the browser directly talking with node-backend ? I need to implement lots of features, apis, etc and ideally I would like to use the browser to test each. Can we pass backend host port and auth token by url parameter or something and make the react app not fail in the browser? 