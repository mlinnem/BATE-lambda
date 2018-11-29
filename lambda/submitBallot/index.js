var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});

const SHADOW_BANNED = "SHADOW_BANNED";
const SHADOWBAN_SUBMISSION_THRESHOLD = 800
const ACCEPTABLE_ABANDON_RATE = .8;
const ACCEPTABLE_CONTRARIAN_RATE = .8;
const WATCH_LISTED = "WATCH_LISTED";
const BALLOT_ABANDONER = "BALLOT_ABANDONER";
const CONTRARIAN = "CONTRARIAN";

// Create an SQS service object

var sqs = new AWS.SQS();
var io = new AWS.DynamoDB.DocumentClient({apiVersion: '2018-10-01'}));

exports.handler = (event, context, callback) => {
  console.log("event:");
  console.log(event);
  var data = event.body;
  var parsedData = JSON.parse(data);

  var winnerID = parseInt(parsedData.WinnerID);
  var loserID = parseInt(parsedData.LoserID);
  var ballotID = parsedData.BallotID;
  var authKey = parsedData.AuthKey;

  var ipAddress = event['requestContext']['identity']['sourceIp'];

  var ballot = {
    "winnerID": winnerID,
    "loserID": loserID,
    "ID": ballotID
  };

  var context = {
    "ballot" : ballot,
    "authKey" : authKey,
    "ipAddress" : ipAddress,
  }

  return getIPData(context)
  .then(silentlyFailIfOnShadowbanList)
  .then(deletePendingBallotOrFail)
  .then(wrapEverythingUp)
  .catch(handleError);
}

function getIPData(context) {
  return backend_getIPData(context.ipAddress)
  .then((result) => {
    context.ipData = result;
    return context;
  });
}

function silentlyFailIfOnShadowbanList(context) {
  var status = context.ipData.status;
  if (status == SHADOW_BANNED) {
    throw "Not today buddy";
  } else {
  return context;
  }
}

function deletePendingBallotOrFail(context) {
  return backend_deletePendingBallots(context.authKey, context.ballot)
  .then((result) => {
    return context;
  });
}

function wrapEverythingUp(context) {
  return Promise.all([backend_recordBallot(context.ballot),
    updateIPData(context.ipAddress, context.ballot),
    generateStandardSuccessResponse])
  .then((results) => {
    standardSuccessResponse = results[2];
    return standardSuccessResponse;
  });
}

function updateIPData(ipAddress, ballot) {
  return backend_incrementAndGetIPData(context.ipAddress, context.ballot)
  .then((ipData) => {
    if warrantsShadowban(ipData) {
      backend_setIPToShadowban(ipAddress);
    }
  });
}

function addToShadowbanListIfWarranted(ipData) {
  console.log("updateToIPAddressStuff:");
  console.log(ipData);

  var submissionCount = 0;
  var contrarianSubmissions = 0;
  var nonContrarianSubmissions = 0;
  var ballotsAbandoned = 0;
  var ballotsNotAbandoned = 0;

  if (submissionCount > SHADOWBAN_SUBMISSION_THRESHOLD) {
    var abandonRate = ballotsAbandoned / (ballotsAbandoned + ballotsNotAbandoned);
    var contrarianRate = contrarianSubmissions / (contrarianSubmissions + nonContrarianSubmissions);

    var newStatus = WATCH_LISTED;
    var reason = null;
    if (abandonRate >  ACCEPTABLE_ABANDON_RATE) {
      newStatus = SHADOW_BANNED;
      reason = BALLOT_ABANDONER;
    } else if (contrarianRate > ACCEPTABLE_CONTRARIAN_RATE) {
      newStatus = SHADOW_BANNED;
      reason = CONTRARIAN;
    }

    if (newStatus == SHADOW_BANNED) {
      return backend_setIPTOShadowban(ipAddress, reason);
    }
  }
}

function generateStandardSuccessResponse(callback) {
    return () => {
      var responseBody = {
      };

      var response = {
        "statusCode": 200,
        "headers": {
          "Access-Control-Allow-Headers": '*',
          "Access-Control-Allow-Origin": '*',
          "Access-Control-Allow-Methods": '*'
        },
        "body": JSON.stringify(responseBody),
        "isBase64Encoded": false;
      };
      callback(null, response);
    };
  }

  //--Backend functions--

  function backend_recordBallot(ballot) {
    return () => {
    console.log("ADDING BALLOT TO QUEUE FOR PROCESSING");
    console.log("params:");
    var params = {
      DelaySeconds: 10, //TODO: Why? Lambda delay something?
      MessageAttributes: {
        "Winner": {
          DataType: "Number",
          StringValue: ballot.winnerID.toString()
        },
        "Loser": {
          DataType: "Number",
          StringValue: ballot.loserID.toString()
        },
      },
      MessageBody: "Ballot Submission",
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/395179212559/BothAreTotallyEnraged_Queue"
    };

    console.log(params);
    return sqs.sendMessage(params, function(err, data) {
        if (err) {
          console.log("Error!!", err);
        } else {
          console.log("Successfully added message to queue", data.MessageId);
          console.log(data);
        }
      });
  };
}

  function backend_deletePendingBallotOrFail(ballot_and_authKey) {
    console.log("DELETING SUBMITTED BALLOT FROM PENDING BALLOTS");
    var submittedBallot = ballot_and_authKey[0];
    console.log("submittedBallot:");
    console.log(submittedBallot);
    var authKey = ballot_and_authKey[1];
    var delete_params = {
      "TableName": "PendingBallots",
      "Key": {
          "SessionID": authKey,
          "PendingBallotID": submittedBallot.ID
      },
      "ConditionalExpression" : "attribute_exists(Animal1ID)" //TODO: Is this the right way to do this?
    };

    return io.delete(delete_params).promise();
  }

  function backend_incrementIPData(ipAddress, isContrarian) {
    var contrarianIncrement = 0;
    var nonContrarianIncrement = 0;
    if (isContrarian) {
        contrarianIncrement = 1;
    } else {
      nonContrarianIncrement = 1;
    }

    //TODO: Need to create table row in the first place if it doesn't exist.
    //Should work according to dynamodb docs but not certain

    var updateParams = {
      "TableName" : "IPData",
      "Key" : {
        "IPAddress" : ipAddress
      },
      "UpdateExpression" : 'SET Submissions = Submissions + :s_inc, ContrarianSubmissions = ContrarianSubmissions + :c_inc, NonContrarianSubmissions = NonContrarianSubmissions + :n_inc, BallotsNotAbandoned = BallotsNotAbandoned + :b_inc',
      "ExpressionAttributeValues" : {"s_inc" : 1, "c_inc" : contrarianIncrement, "n_inc" : nonContrarianIncrement, "b_inc" : 1},
      "ReturnValues" : "ALL_NEW"
      }

    return io.update(updateParams).promise()
    .then((result) {
      console.log("result of updated IP data");
      console.log(result);
      if (isShadowBanWorthy(result)) {
        backend_setIPToShadowban(ipAddress);
      }
    }
  }

  //--Utility functions--

  function handleError(error) {
    console.error(error);
  }
