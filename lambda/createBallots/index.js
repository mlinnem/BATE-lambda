var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

const crypto = require("crypto");

//var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});

var io = new AWS.DynamoDB.DocumentClient();

exports.handler = (event) => {
    var authKey = event["queryStringParameters"]['authkey'];

    console.log("authKey");
    console.log(authKey);
    return createBallots(authKey);
}

//--Main--

function createBallots(authKey) {
    return getAnimalsAndPendingBallots(authKey)
    .then(generateNewBallotsAndWriteToPendingBallots)
    .then(returnBallots)
    .catch(logError);
};

function getAnimalsAndPendingBallots(authkey) {
    return Promise.all([getAnimals(), getPendingBallots(authkey)]);
}

async function generateNewBallotsAndWriteToPendingBallots(animals_and_pendingBallots) {
      console.log("generateNewBallotsAndWriteToPendingBallots");
      console.log(animals_and_pendingBallots);
      var animals = animals_and_pendingBallots[0];
      var pendingBallots = animals_and_pendingBallots[1];

      var animalCount = getAnimalCount(animals);

      var newBallotsNeeded = calculateBallotsToProvide(pendingBallots);

      var newBallots = generateNewBallots(newBallotsNeeded, animalCount);
      await writeNewBallotsToPendingBallots(newBallots);
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
  putRequests = [];
  for (var pendingBallot of pendingBallots) {
    var putRequest = {
      PutRequest: {
        Item: {
          SessionID: authKey,
          PendingBallotID: pendingBallot[2],
          Animal1ID: pendingBallot[0],
          Animal2ID: pendingBallot[1],
          CreatedAt: new Date().getTime()
        }
      }
    };
    putRequests.push(putRequest);
  }

  var batchWrite_params = {
  RequestItems: {
    'PendingBallots': putRequests
  };

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
  Key: {
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

function backend_getPendingBallots(authKey) {
  var get_params = {
    TableName : 'PendingBallots',
    Key: {
      SessionID: authKey
      }
  };

  return io.get(get_params).promise();
}

//--Utility functions--

function writeNewBallotsToPendingBallots(newBallots) {
  //TODO: This can maybe occur asynchronously with respect to just returning the ballots to the user.
  //BUT they have to be written before the user tries to submit the ballot, otherwise backend will think it's bogus.
     return batchWritePendingBallots(newBallots);
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
               var ballot = [animal_1_num, animal_2_num];
               const uniqueID = getUniqueID();
               ballot = ballot.concat(uniqueID);

            newBallots.push(ballot);
            console.log("New ballots is now");
            console.log(newBallots);
        }
        return newBallots;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateBallotsToProvide(session) {
  var num = 15 - session.Item.PendingBallots.length
  console.log("CURRENTLY WAITING ON " + session.Item.PendingBallots.length + " BALLOTS");
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
