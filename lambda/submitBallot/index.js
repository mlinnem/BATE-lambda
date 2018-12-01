var AWS = require('aws-sdk');
// Set the region
AWS.config.update({
  region: 'us-east-1'
});

const SHADOW_BANNED = "SHADOW_BANNED";
const SHADOWBAN_SUBMISSION_THRESHOLD = 800
const ACCEPTABLE_ABANDON_RATE = .8;
const ACCEPTABLE_CONTRARIAN_RATE = .8;
const WATCH_LISTED = "WATCH_LISTED";
const BALLOT_ABANDONER = "BALLOT_ABANDONER";
const CONTRARIAN = "CONTRARIAN";

// Create an SQS service object

var sqs = new AWS.SQS();
var io = new AWS.DynamoDB.DocumentClient({
apiVersion: '2018-10-01'
});

exports.handler = async (event, context, callback) => {
  console.log("event:");
  console.log(event);

  var data = event.body;
  var parsedData = JSON.parse(data);

  var winnerSide = parsedData.WinnerSide);
  var ballotID = parsedData.BallotID;
  var authKey = parsedData.AuthKey;

  var ipAddress = event['requestContext']['identity']['sourceIp'];

  var ballot = {
    "WinnerSide": winnerSide,
    "ID": ballotID,
  };
  //TODO: Work ballot side through UI
  
  return submitBallot(ipAddress, authKey, ballot);
}

function submitBallot(ipAddress, authKey, ballot, callback) {
  try {
    var ipData = await getIPData(ipAddress);
    if (isShadowBanned(ipData)) {
      return shadowBanResponse(callback);
    }

    await backend_verifyAndDeletePendingBallot(authKey, ballot);
    await Promise.all([backend_recordBallot(authKey, ballot), updateIPData(ipData, ballot)]); //TODO: Is await needed here or can we just return?

    return generateStandardSuccessResponse(callback);

  } catch (error) {
    handleError(error);
  }
}

//--Main flow--

function backend_verifyAndDeletePendingBallot(authKey, submittedBallot) {
  console.log("DELETING SUBMITTED BALLOT FROM PENDING BALLOTS");
  console.log("submittedBallot:");
  console.log(submittedBallot);

  var delete_params = {
    "TableName": "PendingBallots",
    "Key": {
      "SessionID": authKey,
      "PendingBallotID": submittedBallot.ID
    },
    "ConditionalExpression": "attribute_exists(Animal1ID)" //TODO: Is this the right way to do this?
  };

  return io.delete(delete_params).promise();
}

function backend_recordBallot(authkey, ballot) {
  console.log("ADDING BALLOT TO QUEUE FOR PROCESSING");

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

function generateStandardSuccessResponse(callback) {
  return () => {
    var responseBody = {};

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

//--IP data flow--

function getIPData(ipAddress) {
  return backend_getIPData(context.ipAddress)
  .then((response) {
    console.log("GOT IP DATA RESPONSE");
    console.log("response:");
    console.log(response);
  }
}

function isShadowBanned(ipData) {
  return ipData.status == SHADOW_BANNED;
}


function shadowBanResponse(callback) {
  sleep(Math.random() * 500);
  return generateStandardSuccessResponse(callback);
}


//--Backend--
function backend_getIPData(ipAddress) {

}

  //--Utility functions--

function handleError(error) {
    console.error(error);
  }
