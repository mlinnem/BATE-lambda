var AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: 'US-EAST-1'});

// Create an SQS service object
var sqs = new AWS.SQS();

exports.handler = (event, context, callback) => {
   // Load the AWS SDK for Node.js
console.log("The event");
console.log(event);
console.log(context);
console.log(callback);
console.log("THAT EVENT BODY");
console.log(event.body);
var data = event.body;
var parsedData = JSON.parse(data);
console.log("parsed data");
console.log(parsedData);
console.log("winnerID and loser ID");
var winnerID = parsedData.WinnerID;
var loserID = parsedData.LoserID;
console.log(winnerID);
console.log(loserID);
var params = {
 DelaySeconds: 10,
 MessageAttributes: {
  "Winner": {
    DataType: "Number",
    StringValue: winnerID.toString()
   },
  "Loser": {
    DataType: "Number",
    StringValue: loserID.toString()
   },
 },
 MessageBody: "Ballot Submission",
 QueueUrl: "https://sqs.us-east-1.amazonaws.com/395179212559/BothAreTotallyEnraged_Queue"
};

console.log("PARAMS ARE>>>>");
console.log(params);

sqs.sendMessage(params, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data.MessageId);
    console.log(data);
  }
});
var responseBody = {
        "foo": "bar",
    };

    var response = {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Headers": '*',	  
                      "Access-Control-Allow-Origin": '*', 
                      "Access-Control-Allow-Methods": '*' },
        "body": JSON.stringify(responseBody),
        "isBase64Encoded": false
    };
    callback(null, response);
    console.log("Response");
    console.log(response);
    return response;
};
