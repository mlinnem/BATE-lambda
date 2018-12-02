var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

const crypto = require("crypto");

var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});

var io = new AWS.DynamoDB.DocumentClient({apiVersion: '2018-10-01'});

exports.handler = (event) => {
    var authKey = event["queryStringParameters"]['authkey'];

    console.log("authKey");
    console.log(authKey);
    return createBallots(authKey);
}

//--Main--

function createBallots(authKey) {
    return confirmAuthKeyIsReal(authKey)
    .then(getAnimalsAndPendingBallots)
    .then(generateNewBallotsAndWriteToPendingBallots)
    .then(returnBallots)
    .catch(logError);
};

async function confirmAuthKeyIsReal(authKey) {
    var result = await backend_getAuthKey(authKey); //TODO: This could be more efficiently combined with the general read operation. If 0 pendingBallots are returned it's fishy.
    console.log("result of getAuthKey:");
    console.log(result);
    if (result.Items.length == 1) {
        return authKey;
    } else {
        throw "Auth key is a sham! Abort!"; //TODO: This is a signal that tomfoolery is occurring, or code is wrong.
    }

}

function getAnimalsAndPendingBallots(authKey) {
    return Promise.all([getAnimals(), getPendingBallots(authKey)])
    .then((result) => {
         var authKey_and_animals_and_pendingBallots = [authKey, result[0], result[1]]
        return authKey_and_animals_and_pendingBallots;
    });
}

function getPendingBallots(authKey) {
    return backend_getPendingBallots(authKey)
    .then((pendingBallots) => {
        console.log("pendingBallots:");
        console.log(pendingBallots.Items);
        return pendingBallots.Items;
    });
}

async function generateNewBallotsAndWriteToPendingBallots(authKey_and_animals_and_pendingBallots) {
      console.log("generateNewBallotsAndWriteToPendingBallots");
      console.log(authKey_and_animals_and_pendingBallots);

      var authKey = authKey_and_animals_and_pendingBallots[0];
      var animals = authKey_and_animals_and_pendingBallots[1];
      var pendingBallots = authKey_and_animals_and_pendingBallots[2];

      var animalCount = getAnimalCount(animals);

      var newBallotsNeeded = calculateBallotsToProvide(pendingBallots);

      var newBallots = generateNewBallots(newBallotsNeeded, animalCount);
      await writeNewBallotsToPendingBallots(authKey, newBallots)
      .catch(logError);

      return newBallots;
}


function returnBallots(ballots) {
    console.log("Outgoing response...");
      const response = {
          "statusCode": 200,
          "isBase64Encoded": false,
          "headers": {"Access-Control-Allow-Headers": '*',
                    "Access-Control-Allow-Origin": '*',
                    "Access-Control-Allow-Methods": '*' },
          "body": JSON.stringify(ballots),
      };
      console.log(response);
      return response;
}

//--Backend functions--


function batchWritePendingBallots(authKey, pendingBallots) {
  console.log("BATCH WIRITNG PENDING BALLOTS");
  var putRequests = [];
  for (var pendingBallot of pendingBallots) {
    var putRequest = {
      PutRequest: {
        Item: {
          SessionID: authKey,
          PendingBallotID: pendingBallot.ID,
          Animal1ID: pendingBallot.Animal1ID,
          Animal2ID: pendingBallot.Animal2ID,
          CreatedAt: new Date().getTime()
        }
      }
    };
    putRequests.push(putRequest);
  }

  var batchWrite_params = {
    RequestItems: {
        'PendingBallots': putRequests
    }
  };

    console.log("batchWrite_params:");
    console.log(batchWrite_params);
  return io.batchWrite(batchWrite_params).promise();
}

// function writeSession(session) {
//       var put_params = {
//         Item: session.Item,
//         TableName: 'AuthKey_To_Ballots'
//       };
//
//       console.log("Attempting to write session..., params are");
//       console.log(put_params);
//       var request = io.put(put_params);
//
//       var promise = request.promise();
//       return promise;
// }

function getAnimals() {
  var get_params = {
  "Key": {
   "ID": "0",
  },
  TableName: "AllAnimals"
 };

 console.log("Get Animals params");
 console.log(get_params);
 var request = io.get(get_params);
 var promise = request.promise();
 return promise;
}

//TODO: Shared with other functions. Should maybe be abstracted out.
// function getSession(authkey) {
//     console.log("Authkey in session");
//     console.log(authkey);
//     var get_params = {
//   Key: {
//    "AuthKey": authkey,
//   },
//   TableName: "AuthKey_To_Ballots"
//  };
//
//  console.log("Get Session params");
//  console.log(get_params);
//  var request = io.get(get_params);
//  var promise = request.promise();
//  return promise;
// }

const PENDINGBALLOTID_PREFIX = "ballot_"

function backend_getPendingBallots(authKey) {
    console.log("GETTING PENDING BALLOTS");
  var query_params = {
    TableName : 'PendingBallots',
    KeyConditionExpression : "SessionID = :authKey AND begins_with(PendingBallotID, :pendingBallotID_prefix)",
    ExpressionAttributeValues : {
        ":authKey" : authKey,
        ":pendingBallotID_prefix" : PENDINGBALLOTID_PREFIX
    }
  };

//   var params = {
//   RequestItems: {
//     'PendingBallots': {
//       Keys: [
//         {'KEY_NAME': {N: 'KEY_VALUE_1'}},
//         {'KEY_NAME': {N: 'KEY_VALUE_2'}},
//         {'KEY_NAME': {N: 'KEY_VALUE_3'}}
//       ],
//       ProjectionExpression: 'KEY_NAME, ATTRIBUTE'
//     }
//   }
// };

    console.log("query params:");
    console.log(query_params);

  return io.query(query_params).promise();
}

function backend_getAuthKey(authKey) {
    console.log("GETTING AUTH KEY");
     var query_params = {
    TableName : 'PendingBallots',
    KeyConditionExpression : "SessionID = :authKey AND begins_with(PendingBallotID, :session)",
    ExpressionAttributeValues : {
        ":authKey" : authKey,
        ":session" : "session"
    }
  };


    console.log("get params:");
    console.log(query_params);
    return io.query(query_params).promise();
}

//--Utility functions--

function writeNewBallotsToPendingBallots(authKey, newBallots) {
  //TODO: This can maybe occur asynchronously with respect to just returning the ballots to the user.
  //BUT they have to be written before the user tries to submit the ballot, otherwise backend will think it's bogus.
     return batchWritePendingBallots(authKey, newBallots);
}

function generateNewBallots(newBallotsNeeded, animalCount) {
    var newBallots = [];
        for (var i=0; i < newBallotsNeeded; i++) {
            console.log("I is " + i);
            var animal_1_num = 0;
            var animal_2_num = 0;
            //TODO: This will become a problem if the valid ID list is ever sparse (i.e. we remove an ID).
            animal_1_num = getRandomInt(0, animalCount - 1);
            if (animal_1_num > 0) {
                animal_2_num = animal_1_num - 1;
            } else {
                animal_2_num = animal_1_num + 1;
            }
            if (getRandomInt(0, 1) == 0) {
                //SWAP
                var temp = animal_1_num;
                animal_1_num = animal_2_num;
                animal_2_num = temp;
              }
               var ballot = {"Animal1ID" : animal_1_num, "Animal2ID" : animal_2_num};
                const uniqueID = getUniqueID();
               ballot.ID = PENDINGBALLOTID_PREFIX + uniqueID;
                newBallots.push(ballot);
                console.log("New ballots is now");
                console.log(newBallots);
               }
                   return newBallots;
        }

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateBallotsToProvide(pendingBallots) {
  var num = 15 - pendingBallots.length;
  console.log("CURRENTLY WAITING ON " + pendingBallots.length + " BALLOTS");
  console.log("GENERATING AND SENDING " + num + " NEW ONES");
  return num;
}

function getAnimalCount(animals) {
  console.log("Animals in animal count");
  console.log(animals);
  var animalMap = animals.Item.Animals;
  var count = Object.keys(animalMap).length;
  return count;
}


function logError(error) {
    console.error(error);
}

function getUniqueID() {
  return crypto.randomBytes(16).toString('base64');
}

function printOutput(object) {
    console.log("print Output: " + typeof object);
    console.log(object);
    return object;
}
