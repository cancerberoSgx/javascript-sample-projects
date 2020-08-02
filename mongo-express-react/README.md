mongodb, express, react application to display/filter/search movies and series catalog

movies and series are fetched from some torrent sites and are inserted to mongodb collections. 

no data is maintained, to create it and load it:

```
npm run download # generates static/movies.json
npm run create-db # loads file into mongodb collection
```