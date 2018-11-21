
  const crypto = require("crypto");

var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});

var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});


    //create unique AuthKey
    //write unique AuthKey to database
    //return unique AuthKey

exports.handler = (event, context, callback) => {

    //create unique AuthKey

    const id = crypto.randomBytes(24).toString('base64');
    console.log("id is ");
    console.log(id);
    //write unique AuthKey to database

    //TODO: Check whether it's okay that we move on and return.
    writeNewAuthKey(id).then(function(response) {
        console.log("Success");
        console.log(response);
    }, function(err) {
        console.log("Error");
        console.error(err);
    });

    console.log("About to send response");
    var response = {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Headers": '*',
                      "Access-Control-Allow-Origin": '*',
                      "Access-Control-Allow-Methods": '*' },
        "body": {"AuthKey" : id},
        "isBase64Encoded": false
    };

    callback(null, response);
};

function writeNewAuthKey(id){
 var put_params2 =
 { "Item": {
  "AuthKey": {
    "S": id.toString()
  },
  "PendingBallots": {
    "L": []
  },
  "LastUpdated": {
    "S": new Date().toString()
  }
 },
 "TableName" : "AuthKey_To_Ballots"
};
 var put_params =
  {
      "Item" : {
    "AuthKey": id,
    "PendingBallots": []
    },
    "TableName" : "AuthKey_To_Ballots"
  };
  console.log("put params are");
  console.log(put_params2);
 var request = ddb.putItem(put_params2);
 var promise = request.promise();
 return promise;
}
