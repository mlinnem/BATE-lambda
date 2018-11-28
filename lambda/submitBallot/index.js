var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});


// Create an SQS service object
var sqs = new AWS.SQS();
var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});
var io = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
  console.log("event:");
  console.log(event);
  var data = event.body;
  console.log(data);
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

  var ballot_and_authKey = [ballot, authKey];


  return silentlyFailIfOnShadowbanList(ipAddress)
  .then(submitBallot(ballot_and_authKey, callback))
  .then(doIPBehaviorBookkeeping(ipAddress))
  .catch(handleError);
}

function silentlyFailIfOnShadowbanList(ipAddress) {
    var status = await backend_getIPAddressStatus(ipAddress);
    if (status == "SHADOWBANNED") {
      throw "Screw you buddy";
    } else {
      return null;
    }
}

function submitBallot(ballot_and_authKey, callback) {
    function () => {
      recordBallotIfValid(ballot_and_authKey)
      .then(prepareResponse(callback))
      .catch(handleError); //TODO: Better error message when ballot is bogus?
    }
}

function recordBallotIfValid(ballot_and_authKey_and_IP) {
  //TODO: Produce an error if deleting something that doesn't exist using conditional dynamodb crap.
  var ballot = ballot_and_authKey[0];
  return backend_deletePendingBallot(ballot_and_authKey_IP)
  .then(doIPBehaviorBookkeeping)
  .then(backend_addBallotToQueueForProcessing(ballot)); //TODO: These can be parallelized later if needed.
}

function doIPBehaviorBookkeeping(ipAddress) {
  return (ballot_and_authKey) => {
      var ballot = ballot_and_authKey[0];
      return backend_updateWatchlistBookkeeping(ipAddress, isContrarianBallot(ballot))
      .then(addToShadowbanListIfWarranted);
  }
}

const SHADOWBAN_SUBMISSION_THRESHOLD = 1600
const ACCEPTABLE_ABANDON_RATE = .8;
const ACCEPTABLE_CONTRARIAN_RATE = .8;

function addToShadowbanListIfWarranted(updateResult) {
  console.log("updateToIPAddressStuff:");
  console.log(updateResult);

  var submissionCount = 0;
  var contrarianSubmissions = 0;
  var nonContrarianSubmissions = 0;
  var ballotsAbandoned = 0;
  var ballotsNotAbandoned = 0;

  if (submissionCount > SHADOWBAN_SUBMISSION_THRESHOLD) {
    var abandonRate = ballotsAbandoned / (ballotsAbandoned + ballotsNotAbandoned);
    var contrarianRate = contrarianSubmissions / (contrarianSubmissions + nonContrarianSubmissions);


  }

  //   If submissionCount > 1600 && (isContrarian || ballotAbandoner): (IP address -> voteCount, IP address to contrary/not count, IP address -> ballots abandoned vs not)
  //     Add to ban list. (Write to status)
}

function prepareResponse(callback) {
    return () => {
      var responseBody = {
        "foo": "bar", //TODO: No
      };

      var response = {
        "statusCode": 200,
        "headers": {
          "Access-Control-Allow-Headers": '*',
          "Access-Control-Allow-Origin": '*',
          "Access-Control-Allow-Methods": '*'
        },
        "body": JSON.stringify(responseBody),
        "isBase64Encoded": false
      };
      callback(null, response);
    };
  }

  //--Backend functions--

  function backend_addBallotToQueueForProcessing(ballot) {
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
  }

  function backend_deletePendingBallot(ballot_and_authKey) {
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

  function backend_updateWatchlistBookkeeping(ipAddress, isContrarian) {
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
      "ExpressionAttributeValues" : {"s_inc" : 1, "c_inc" : contrarianIncrement, "n_inc" : nonContrarianIncrement, "b_inc" : 1}
      "ReturnValues" : "ALL_NEW"
      }

    return io.update(updateParams).promise();
  }

  //--Utility functions--


  function handleError(error) {
    console.error(error);
  }
