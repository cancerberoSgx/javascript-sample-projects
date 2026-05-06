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


# profiles

context:
end user users the app from a profile. At the beggining user is asked to create a profile by giving a name.
All their connections, views, queries, etc are associated to a profile

tasks:
 * in backend:
   create profiles db table id, name
   add migration to add column connections.profileId FK profiles.id on delete cascade. update ConnectionsRepository to support new profileId field
   create profileRepository with CRUD operations
   create endpoints /api/profiles with CRUD operations for profiles
   update current connections API to be /api/profile/{profileId}/connections

# frontend UI libraries

UI Library                                                                                                                                                                          
                                               
  shadcn/ui is the best fit here, not raw Radix UI alone. Here's why:                                                                                                                 
   
  - shadcn/ui is built on top of Radix primitives — you get all the accessibility and composability of Radix, but with ready-made styled components (sidebar, menus, dialogs, form    
  controls, dropdowns, tabs, etc.)                                
  - Components are copied into your project (not a black-box dependency), so you own the code and can customize freely                                                                
  - Theming via CSS variables is excellent — light/dark mode is trivial, and you can create custom themes                                                                             
  - First-class TypeScript                                                                                                                                                            
  - The Sidebar component added recently is production-quality and exactly what a SQL client needs                                                                                    
                                                                                                                                                                                      
  The main trade-off: it requires Tailwind CSS. That's a small setup cost but Tailwind pairs very well with Tauri apps since there's no stylesheet delivery concern.                  
                                                                                                                                                                                      
  If you want zero Tailwind, Mantine is the runner-up — it's fully self-contained, has more built-in components (rich tables, date pickers, notifications), and excellent theming.    
  Slightly heavier and more opinionated in look.                  
                                                                                                                                                                                      
  Recommendation: shadcn/ui + Tailwind.                           

  ---
  State Management
                  
  Yes, Zustand is the right call. For a SQL client specifically, you'll likely have:
  - Active/open connections                                                                                                                                                           
  - Open query tabs with their SQL text and results                                                                                                                                   
  - UI state (selected sidebar item, panel sizes, etc.)                                                                                                                               
                                                                                                                                                                                      
  Zustand's flat store model fits this naturally — no boilerplate, great TypeScript inference, and you can slice it into separate stores per concern.
                                                                                                                                                                                      
  Pair it with TanStack Query for server state (your Node API calls). Zustand handles client/UI state; TanStack Query handles fetching, caching, and invalidating API responses. They 
  compose cleanly and avoid you having to manually manage loading/error states in Zustand.                                                                                            
                                                                                                                                                                                      
  Recommendation: Zustand + TanStack Query. 




p2:

implement the suggested libraries in the frontend and adapt current source code to use them

delete current UI
add a sidebar the left with options "profile", "connections", "queries", "settings" currently to-be-implemented. The sidebar must be collapsible.
In the sidebar there'a last item "debug" which calls endpoint /api/health and display response.


p3
in the frontend, On "new connection" (ConnectionForm), I'm getting a validation errors on all fields when clicking "Save connection". error "Invalid input: expected string, received undefined"



# postgres integration

in the backend, install a postgres client library which should be 100% javascript (user might not have python or dev tools to compile)
create a postgres.ts file which given a Connection data object, it connects to db and using that conn allows to execute queries. Support connection pools and reuse of same connection for performance.
Note: this is for the sql client app to allow users to query their dbs, has nothing to do with current sql lite local model db

# db connection.type

in db connections table, add column "type text not null". Update repository and endpoints
in frontend connections form, add the "type" field now returned by API, dropdown with options "postgres" (default) and "mysql". Allow user to read and write/edit

# db connect
context:
we want to implement a facade for certain operations on a connection, such as execute queries, query tables, query table fields and indexes, etc
Currently we will be only supporting postgres db connection type, but in the future there will be other "connectors" implementations such as mysql, sqllite, etc

tasks:
in the backend, there are two new endpoints to list tables and table fields in connections:
get /api/connections/{connectionId}/tables  get the db tables and any metadata
get /api/connectoins/{connectionId}/tables/{tableName}/fields  get given db table fields (with all their metadata)

you must implement this using strategy pattern with one "connector" implementation per each connection type, currently only implement it for postgres. The method signatures should be generic enough to support other databases in the future such as mysql, sqlite, etc

p2:
in the backend, implement a new endpoint
POST /api/connections/{connectionId}/query body {query: string} which allows to execute queries.
Model different query types such as select, create, update, etc with generic response types so they can be used on other db implementations such as mysql, sqlite, etc

p3
in the frontend, when a connection is selected, there are two tabs: "Config", "Tables" 
  * "tables" display the tables or an error msg if connection failed - uses api get /api/connections/{connectionId}/tables 
     * if a table is selected it display its fields - uses api get /api/connectoins/{connectionId}/tables/{tableName}/fields
  * settings: displays current ConnectionForm.tsx component



future

# connection scripts

in the backend:

create a new db table scripts with columns: 
  id (PK)
  connectionId int (FK)
  name text not null
  content text not null.

create a scriptRepository to access this data
create endpoints 

get /api/connections/{connectionId}/scripts to return the list of connection's scripts
post /api/connections/{connectionId}/scripts create a new script
put /api/connections/{connectionId}/scripts/{id} updates script
delete /api/connections/{connectionId}/scripts/{id} updates a new script


p2 future <--- last 

in the frontend, when connection is selected, there's a third tab "Script" which list connection scripts in sub-sub tabs using script name as tab name
if connection don't have any script it creates a new tab "script 1" with empty content
the script screen consist on :
  * a text area with script content
  * an "execute" button which executes the script using api POST /api/connections/{connectionId}/query 
  * a "save" button which allows to save the script
  * a delete button which deletes the script


# ui respect window viewport

in frontend, in listings like table -> data or script -> results, if there are too many columns, the window viewport must be respected. Don't force the user to scroll the viewport itself, add the scroll to the data table instead. 
Rememeber this is a desktop app displayed in a window of arbitrary size, the content scrolling shouolnd't be on the viewport but on overlying children, like the tables with many columns

# scripts data table resize
in frontend, in connection -> scripts user can resize vertically the data-table at the bottom 


# table data

in the backend, there's a new endpoint 
get /api/connections/{connectionId}/tables/{tableName}/data
which allow to query a table records (use select, where, limit, offset, order by etc)
supports 
 * return columns (default return all columns)
 * column sorting asc desc
 * column filtering (exact value, lower than, greater than, %like expressions) - can apply multiple filters
 * pagination (limit, offset)


p2 
in the frontend, when a table is selected display two tabs:
 * "fields" -> display table fields just as we are now doing
 * "data" -> display a table of records
   * allows to order by column
   * allows to apply filters on each field
   * allows to select which columns want to see (default all)


the endpoint not only returns the result records, but also a "total" field counting total records complying with filters if any.




# csv

context:
users must be able to download the table's data or script query results into csv file

tasks:
 * in the backend:
    * add a csv generator library written 100% in javascript (no binaries) which can generate ++1 millon rows csv performant
    * in the api POST /api/connections/{connectionId}/query , add an optional parameter format?: 'csv'. If given the endpoint will generate a csv file and stream it so it can be easily downloaded by the frontend    
    * in the api get /api/connections/{connectionId}/tables/{tableName}/data add an optional query param format?: 'csv'. If given the endpoint will generate a csv file and stream it so it can be easily downloaded by the frontend    

 * in the frontend:
    * in table -> data screen, add a "download csv" button next to "columns". it will call get /api/connections/{connectionId}/tables/{tableName}/data with format=csv and it will download response file
    * in scripts, add a "download csv" button next to "Save" button. It is enable if there are query results and will call api POST /api/connections/{connectionId}/query with format=csv and download response file


p2: 
context: 
in tauri context, download and save csv from the frontend doesn't work. We need to tell the backend to save the file. in the browser download csv works OK.
tasks: 
 * in the backend, for csv apis POST /api/connections/{connectionId}/query and get /api/connections/{connectionId}/tables/{tableName}/data an optional parameter outputFilePath can be passed, if so, the backend itself will save the csv file on that path or return 500 error if the file path is invalid or there's an error writing file.
 * in the frontend, if isTauri(), ask the user first in a modal for a file path (string absolute path) and pass it as parameter in the download api outputFilePath=




p3:
* in the frontend, when asking for csv file path, remember the previous one
* in the backend, in all download csv operations, convert the timestamps (or any time/date field) to format YEAR-MONTH-DAY:HOUR:MINUTE:SECOND (the standard utc format)

use toast 
csv download success or failures




# FUTURE: 
when invalid token, make a frontend with error 