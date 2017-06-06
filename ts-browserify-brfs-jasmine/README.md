#a js sample project with:

 * typescript, 
 * browserify, 
 * brfs, 
 * node

the idea is to be able to write code using ts, being able to require pure js libraries, and be able to use browserify and brfs utility like to go to the browser. Also have some unit test with jasmine that run in node

##run it in node

	tsc src/index.ts
	node src/

## run specs in node

(specs written with jasmine)

	tsc spec/*.ts
	npm test

## browser 

(same as before but this time open it in html browser)

	browserify -o dist/bundle.js -p tsify -t brfs --debug src/index.ts
	firefox dist/index.html


## browserify bundle in node 

(same as before but run it in node)

	browserify -o dist/bundle.js -p tsify -t brfs --debug src/index.ts
	node dist/bundle.js

##development framework

(first command will watch for file changes in .ts and recompile bundle.js automatically) 

	watchify -o dist/bundle.js -p tsify -t brfs --debug src/index.ts
	firefox dist/index.html

