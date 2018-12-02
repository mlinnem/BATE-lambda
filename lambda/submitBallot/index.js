var AWS = require('aws-sdk');
// Set the region
AWS.config.update({
  region: 'us-east-1'
});



// Create an SQS service object

var sqs = new AWS.SQS();
var io = new AWS.DynamoDB.DocumentClient({
apiVersion: '2018-10-01'
});
var sns = new AWS.SNS();

exports.handler = (event, context, callback) => {
  console.log("event:");
  console.log(event);

  var data = event.body;
  var parsedData = JSON.parse(data);

  var winnerSide = parsedData.WinnerSide;
  var submittedBallotID = parsedData.BallotID;
  var authKey = parsedData.AuthKey;

  var ipAddress = event['requestContext']['identity']['sourceIp'];


  return submitBallot(ipAddress, authKey, winnerSide, submittedBallotID);
}

async function submitBallot(ipAddress, authKey, winnerSide, submittedBallotID) {
  try {
    console.log("IN SUBMIT BALLOT");
    var isReallyShadowBanned = await isShadowBanned(ipAddress);
    console.log("isShadowBanned:");
    console.log(isReallyShadowBanned);
    if (isReallyShadowBanned) {
      console.log("IS SHADOW BANNED");
      await sleep(Math.random() * 300);
      return getStandardSuccessResponse();
    }

    console.log("NOT SHADOW BANNED");

    // var getOfPendingBallot = await backend_getPendingBallot(authKey, submittedBallotID);
    // console.log("getOfPendingBallot:");
    // console.log(getOfPendingBallot);
    var oldPendingBallot = await backend_verifyDeleteAndGetPendingBallot(authKey, submittedBallotID);

    var [winnerID, loserID] = getWinnerAndLoserIDs(oldPendingBallot, winnerSide);
    backend_recordBallot(winnerID, loserID);

    var result = await backend_publishBallotSubmission(authKey, ipAddress, winnerID, loserID);
    console.log("result from sns");
    console.log(result);


    return getStandardSuccessResponse();

  } catch (error) {
    console.log("ERROR!!!!");
    handleError(error);
  }
}

//--Main flow--

function backend_verifyDeleteAndGetPendingBallot(authKey, submittedBallotID) {
  console.log("DELETING SUBMITTED BALLOT FROM PENDING BALLOTS");
  console.log("submittedBallotID:");
  console.log(submittedBallotID);

  var delete_params = {
    "TableName": "PendingBallots",
    "Key": {
      "SessionID": authKey,
      "PendingBallotID": submittedBallotID
    },
    "ConditionalExpression": "attribute_exists(Animal1ID)",
    "ReturnValues" : "ALL_OLD" //TODO: Is this the right way to do this?
  };

  return io.delete(delete_params).promise()
  .then((result) => {
    return result.Attributes;
  });
}

function backend_getPendingBallot(authKey, submittedBallotID) {
  var get_params = {
    "TableName": "PendingBallots",
    "Key": {
      "SessionID": authKey,
      "PendingBallotID": submittedBallotID
    },
  };

  console.log("BACKEND_GETPENDINGBALLOT");
  console.log("get_params:");
  console.log(get_params);
  return io.get(get_params).promise();
}

function backend_recordBallot(winnerID, loserID) {
  console.log("ADDING BALLOT TO QUEUE FOR PROCESSING");

  var params = {
    DelaySeconds: 10, //TODO: Why? Lambda delay something?
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

  console.log("params:");
  console.log(params);

  return sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log("Error!!", err);
    } else {
      console.log("Successfully added message to queue", data.MessageId);
      console.log(data);
    }
  });
}

function backend_publishBallotSubmission(authKey, ipAddress, winnerID, loserID) {
  var publish_params = {
  Message: JSON.stringify({"SessionID" : authKey, "IPAddress" : ipAddress, "WinnerID" : winnerID, "LoserID" : loserID}), /* required */
  TopicArn: 'arn:aws:sns:us-east-1:395179212559:successfulBallotSubmission'
};
  return sns.publish(publish_params).promise()
  .then((result) => {
    console.log("SNS RESULT:");
    console.log(result);
  })
  .catch((error) => {
    console.log("SNS SCREWED UP");
    console.log(error);
    console.error(error);
  });
}

function getStandardSuccessResponse() {
    var responseBody = {};

    var response = {
      "statusCode": 200,
      "headers": {
        "Access-Control-Allow-Headers": '*',
        "Access-Control-Allow-Origin": '*',
        "Access-Control-Allow-Methods": '*'
      },
      "body": JSON.stringify(responseBody),
      "isBase64Encoded": false,
    };
    return response;
}

function backend_getIPData(ipAddress) {
  var get_params = {
  Key: {
   "IPAddress": ipAddress
  },
  TableName: "IPData"
 };

  //TODO: Save a bit of performance if we just pass this over the SNS instead of re-grabbing. A little freshness issue but not sure if material.
 return io.get(get_params).promise();
}

  //--Utility functions--

//TODO: be more clear about pendingBallot, submitted Ballot, etc.
function getWinnerAndLoserIDs(oldPendingBallot, winnerSide) {
  var winnerID = null;
  var loserID = null;
  console.log("GET WINNER AND LOSER IDS");
  console.log("oldPendingBallot");
  console.log(oldPendingBallot);
  if (winnerSide == "LEFT") {
    winnerID = oldPendingBallot.Animal1ID;
    loserID = oldPendingBallot.Animal2ID;
  } else if (winnerSide == "RIGHT") {
    winnerID = oldPendingBallot.Animal2ID;
    loserID = oldPendingBallot.Animal1ID;
  } else {
    throw "Invalid side " + winnerSide;
  }

  return [winnerID, loserID];
}
async function isShadowBanned(ipAddress) {
  console.log("Getting IP Data");
  var ipData = await backend_getIPData(ipAddress);
  console.log("Got IP Data:");
  console.log(ipData);
  return ((ipData != null) && (ipData.status == "SHADOW_BANNED"));
}
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms);
    });
}
function handleError(error) {
    console.log(error);
    console.error(error);

  }
