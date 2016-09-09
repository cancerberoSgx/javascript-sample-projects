Notes from a beginner in the form of a shell script:

	#Requirement: docker is installed
	cd dockertest
	docker build -t vm1 .

	#how to run a bash (mount current dir into guest /hostShared folder)
	docker run -it -v `pwd`:/hostShared vm1 bash

	#Run vm1 node http server executing a mounted script
	docker run -v `pwd`:/hostShared vm1 sh /hostShared/guest/script1.sh

	#see vm1 container id
	docker ps | vm1

	docker kill 1cbbcf7779f5