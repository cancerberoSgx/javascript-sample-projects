## What

A project to play with mongodb, express, react application to display/filter/search implementing movies and series catalog

 * home made store&state&StoreComponent
 * home made routing&Link&history state
 * no security/user auth
 * react, semantic-ui
 * express, celebrate, mongodb


## run the server

(assuming db is up and "get the data" was done, see below)

```
npm run server # production
npm run server:watch # watch mode 
npm run build # production
npm run client # watch mode
firefox localhost:3000
```

## start db

start mongodb:

```
mkdir -p data
mongod --dbpath=$PWD/data
```


## get the data

movies and series are fetched from some t sites and are inserted to mongodb collections. 

no data is maintained, to create it and load it:

```
npm run download # generates static/movies.json
npm run create-db # loads file into mongodb collection
```



## tips



## TODO

 * download t files: movies.json, for each t try download the file:
   * if 404 then remove the t file from movies.json
   * if 200 store document {url: tUrl, data: base64} in file static/movieFiles.json
 * besides createMovies will also create collection "movieFiles"
 * use T library, try to download T to get seeds/feeds and update it.
