#failed try  of making a script that lauch both guard and node

# EXIT=0
trap exiting SIGINT

exiting() { 
	echo "SIGINT detected - killing child proccesses" 
	killall guard node xterm
	EXIT=1
	exit
}

xterm -iconic guard & 

echo "guard lanched"

node server.js & 

echo "server launched"

# while [ $EXIT -eq 0 ] ; do
while [ true ] ; do
    # wine theprogram
    # echo "theprogram killed or finished"
    # date
    # echo "exit code $?"
    # echo "sleeping for 20 seconds, then restarting theprogram..."
    sleep 100
done
