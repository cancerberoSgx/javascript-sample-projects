## What

A project to play with mongodb, express, react application to display/filter/search implementing movies and series catalog

## scripts

```
npm run server
npm run client
```

## Data

movies and series are fetched from some t sites and are inserted to mongodb collections. 

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

## TODO

 * download t files: movies.json, for each t try download the file:
   * if 404 then remove the t file from movies.json
   * if 200 store document {url: tUrl, data: base64} in file static/movieFiles.json
 * besides createMovies will also create collection "movieFiles"
 * use T library, try to downlownload T to get seeds/feeds and update it.
