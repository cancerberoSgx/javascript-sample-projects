## What

A project to play with mongodb, express, react application to display/filter/search implementing movies and series catalog

## scripts

```
npm run server
npm run client
```

## Data

movies and series are fetched from some torrent sites and are inserted to mongodb collections. 

no data is maintained, to create it and load it:

```
npm run download # generates static/movies.json
npm run create-db # loads file into mongodb collection
```

## tips

start mongodb

```
mkdir data
mongod --dbpath=$PWD/data
```
