#!/bin/bash
# ejecuta screen remotos en los SERVERS
 
SERVERS="guard server2 server3 server4 server5"
 
case $1 in
start) for i in $SERVERS; do
       ssh -p222 -i ~/.ssh/cert1 rodolfo@$i screen -dmS prueba watch ls -al
       done ;;
stop)  for i in $SERVERS; do
       ssh $i 'kill $(pidof SCREEN)'
       done ;;
*)     typeset -i a=1
       for i in $SERVERS; do
          echo "$a ==== $i"
          ssh $i '/usr/bin/screen -list | grep Detached'
          a=$a+1
       done ;;
esac
 
exit 0