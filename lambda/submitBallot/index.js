var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});


// Create an SQS service object
var sqs = new AWS.SQS();
var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});
var io = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
  var data = event.body;
  console.log(data);
  var parsedData = JSON.parse(data);

  var winnerID = parseInt(parsedData.WinnerID);
  var loserID = parseInt(parsedData.LoserID);
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
  var ballot = ballot_and_authKey[0];
  var authKey = ballot_and_authKey[1];
  console.log(authKey);
  return backend_getSession(authKey)
  .then((session) => {
    console.log("GOT SESSION FROM AUTHKEY");
    return [ballot, session]
  });
}

function recordBallotIfValid(ballot_and_session) {
  console.log("? IS BALLOT VALID ?");
  var ballot = ballot_and_session[0];
  if (isValidBallot(ballot_and_session)) {
    console.log("BALLOT LOOKS VALID");
    return removeBallotFromSession(ballot_and_session)
      .then(backend_addBallotToQueueForProcessing(ballot)); //TODO: These can be parallelized later if needed.
  } else {
    console.log("THIS AINT NO VALID BALLOT! BAIL");
    Promise.reject(); //TODO: Is this right?
  }
}

function removeBallotFromSession(ballotToRemove_and_session) {
  console.log("ATTEMPTING TO REMOVE BALLOT FROM SESSION");
  var ballotToRemove = ballotToRemove_and_session[0];
  console.log("ballotToRemove:");
  console.log(ballotToRemove);
  var session = ballotToRemove_and_session[1];
  console.log("session:");
  console.log(session);
  var pendingBallots = session.Item.PendingBallots;
  var indexToRemove = -1;
  for (var i = 0; i < pendingBallots.length; i++) {
    var pendingBallot = pendingBallots[i];
    if (pendingBallot[2] == ballotToRemove.ballotID) {
      indexToRemove = i;
    }
  }

  if (indexToRemove != -1) {
    console.log("REMOVING BALLOT FROM SESSION");
    pendingBallots.splice(indexToRemove, 1);
    var shrunkenBallots = pendingBallots;
    session.Item.PendingBallots = shrunkenBallots;
    return backend_writeSession(session);
  } else {
    throw "No ballot with ID " + ballotToRemove.ballotID + " was found in pending ballots for this user.";
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

    return sqs.sendMessage(params, function(err, data) {
        if (err) {
          console.log("Error!!", err);
        } else {
          console.log("Success!!", data.MessageId);
          console.log(data);
        }
      });
  }

      //TODO: Should probably return promise instead of above.
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

    var submittedBallotID = submittedBallot.ballotID;
    console.log("submittedBallotID: " + submittedBallotID);
    console.log("session:");
    console.log(session);
    var pendingBallots = session.Item.PendingBallots;
    for (var i = 0; i < pendingBallots.length; i++) {
      var pendingBallot = pendingBallots[i];
      var pendingBallotID = pendingBallot[2];
      console.log("pendingBallotID: " + pendingBallotID);
      if (pendingBallotID == submittedBallotID) {
        console.log("They match!")
        return true;
      }
    }
    console.log("No matches");
    return false;
  }

  function logError(error) {
    console.error(error);
  }
