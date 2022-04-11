## About 

Example typescript project able to compile to an AWS lambda function ready to deploy as zip file. 

This example uses: 

 * moment library to make sure libraries can be packed successfully
 * mysql to access RDS
 * axios to make a request to the internet

## example

```
npm i
npm run build
```

generates lambda_sample.zip ready to deploy

## Notes about lambda configuration

### Give permissions to lambda to access rds:

 * go to configuration -> vpc  - set the same values for vpc, subnet and security group as the elasticbeasntalk instance

 * then add a custom policy in iam role like said here https://stackoverflow.com/questions/41177965/aws-lambdathe-provided-execution-role-does-not-have-permissions-to-call-describ or https://ao.ms/the-provided-execution-role-does-not-have-permissions-to-call-createnetworkinterface-on-ec2/

### Give permissions to lambda to have full internet access 

(axios request to the outside world):

TODO: it currently fails
