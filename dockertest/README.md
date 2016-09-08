Notes from a beginner in the form of a shell script:

	#Requirement: docker is installed
	cd dockertest
	docker build -t vm1 .

	#Run vm1 http server. 1) we mount current dir into guest /hostShared folder, then execute the guest/script1.sh that will end up running http-server program the test mounting current dir in the client and execute ls on the mounted dir
	docker run -v `pwd`:/hostShared vm1 sh /hostShared/guest/script1.sh

	#attach a termianl so I can debug uniz command interactively
	sudo docker attach vm1