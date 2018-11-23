var AWS = require('aws-sdk');
// Set the region
AWS.config.update({
  region: 'US-EAST-1'
});

// Create an SQS service object
var sqs = new AWS.SQS();
var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});
var io = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
  var data = event.body;
  var parsedData = JSON.parse(data);

  var winnerID = parsedData.WinnerID;
  var loserID = parsedData.LoserID;
  var ballotID = parsedData.BallotID;
  var authKey = parsedData.AuthKey;

  var ballot = {
    "winnerID": winnerID,
    "loserID": loserID,
    "ballotID": ballotID
  };

  var ballot_and_authKey = [ballot, authKey]

  return submitBallot(ballot_and_authKey, callback);
}

function submitBallot(ballot_and_authKey, callback) {
  return getSessionUsingAuthKey(ballot_and_authKey)
    .then(recordBallotIfValid)
    .then(prepareResponse(callback))
    .catch(logError);
}

function getSessionUsingAuthKey(ballot_and_authKey) {
  var authKey = ballot_and_authKey[1];
  var session = backend_getSession(authKey);
  return [ballot, session];
}

function recordBallotIfValid(ballot_and_session) {
  if (isValidBallot(ballot_and_session)) {
    return removeBallotFromSession(ballot_and_session)
      .then(backend_addBallotToQueueForProcessing(ballot_and_session[0])); //TODO: These can be parallelized later if needed.
  } else {
    Promise.reject();
  }
}

function removeBallotFromSession(ballotToRemove, session) {
  var pendingBallots = session.Items.PendingBallots;
  var indexToRemove = -1;
  for (var i = 0; i < pendingBallots.length; i++) {
    var pendingBallot = pendingBallots[i];
    if (pendingBallot[2] == ballotToRemove.ballotID) {
      indexToRemove = i;
    }
  }

  if (indexToRemove != -1) {
    pendingBallots.splice(indexToRemove, 1);
    var shrunkenBallots = pendingBallots;
    session.Items.PendingBallots = shrunkenBallots;
    return [ballotToRemove, session];
  } else {
    throw error;
  }
}

  function prepareResponse(callback) {
    return () => {
      var responseBody = {
        "foo": "bar",
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

    return sqs.sendMessage(params, function(err, data) {
        if (err) {
          console.log("Error", err);
        } else {
          console.log("Success", data.MessageId);
          console.log(data);
        }
      }
      //TODO: Should probably return promise instead of above.
    }
  function backend_getSession(authkey) {
        console.log("Authkey in session");
        console.log(authkey);
        var get_params = {
      Key: {
       "AuthKey": authkey,
      },
      TableName: "AuthKey_To_Ballots"
     };

     console.log("Get Session params");
     console.log(get_params);
     var request = io.get(get_params);
     var promise = request.promise();
     return promise;
  }

  function backend_writeSession(session) {
          var put_params = {
            Item: session.Item,
            TableName: 'AuthKey_To_Ballots'
          };

          var request = io.put(put_params);
          var promise = request.promise();
          return promise;
  }
  //--Utility functions--

  function isValidBallot(ballot_and_session) {
    var submittedBallot = ballot_and_session[0];
    var session = ballot_and_session[1];

    var submittedBallotID = ballot.ballotID;

    var pendingBallot = session.Items.PendingBallots[submittedBallotID]; //TODO: This will fail if ballot is not legit.
    if (pendingBallot != null) {
      return true;
    } else {
      return false;
    }
  }

  function logError(error) {
    console.error(error);
  }
