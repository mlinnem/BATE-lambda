var AWS = require('aws-sdk');
// Set the region
var uploadWorked = true;

AWS.config.update({region: 'us-east-1'});

var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});

exports.handler =  (event) => {
    console.log("Event up in here.");
    console.log(event);
    var response = getAnimals()
    .then((animals) => {
    const response = {
        statusCode: 200,
        //TODO: This is dangerous
        headers: {"Access-Control-Allow-Origin" : "*",
        "Access-Control-Allow-Methods" : "*",
        "Access-Control-Allow-Headers" : "*"},
        body: animals
    };
    return response;
    });
    return response;
};

function getAnimals() {
  var get_params = {
  Key: {
   "ID": {
     S: "0",
    },
  },
  TableName: "AllAnimals"
 };

 var request = ddb.getItem(get_params);
 var promise = request.promise();
 return promise;
}
