var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

//var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});

var io = new AWS.DynamoDB.DocumentClient();

exports.handler = (event) => {
    var authKey = event["queryStringParameters"]['authkey'];

    console.log("authKey");
    console.log(authKey);
    createBallots(authKey);
}

//--Main--

function createBallots(authKey) {
    return getAnimalsAndSession(authKey)
    .then(generateNewBallotsAndWriteToSession)
    .then(returnBallots)
    .catch(logError);
};

function getAnimalsAndSession(authkey) {
    return Promise.all([getAnimals(), getSession(authkey)]);
}


function generateNewBallotsAndWriteToSession(animals_and_session) {
      console.log("generateNewBallotsAndWriteToSession");
      console.log(animals_and_session);
      var animals = animals_and_session[0];
      var session = animals_and_session[1];

      var animalCount = getAnimalCount(animals);

      var newBallotsNeeded = calculateBallotsToProvide(session);

      var newBallots = generateNewBallots(newBallotsNeeded, animalCount);
      writeNewBallotsToSession(newBallots, session)
      .catch(logError);

      return newBallots;
}


function returnBallots(ballots) {
      const response = {
          "statusCode": 200,
          "isBase64Encoded": false,
          "headers": {"Access-Control-Allow-Headers": '*',
                    "Access-Control-Allow-Origin": '*',
                    "Access-Control-Allow-Methods": '*' },
          "body": JSON.stringify(ballots),
      };
      return response;
}

//--Backend functions--

function writeSession(session) {
      var put_params = {
        Item: session.Item,
        TableName: 'AuthKey_To_Ballots'
      };

      var request = io.put(put_params);
      var promise = request.promise();
      return promise;
}

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
function getSession(authkey) {
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

//--Utility functions--

function writeNewBallotsToSession(newBallots, session) {
  //TODO: This can maybe occur asynchronously with respect to just returning the ballots to the user.
  //BUT they have to be written before the user tries to submit the ballot, otherwise backend will think it's bogus.
    ///var updatedSession =  Object.assign({}, session, {"PendingBallots" : session.PendingBallots.concat(newBallots)});
    console.log("TOP writeNEwBallotsToSession");
    session.Item.PendingBallots = session.Item.PendingBallots.concat(newBallots);
     console.log("UNDER writeNEwBallotsToSession");
     return writeSession(session);
}

function generateNewBallots(newBallotsNeeded, animalCount) {
        for (var i=0; i < newBallotsNeeded; i++) {
            var animal_1_num = 0;
            var animal_2_num = 0;

                        var newBallots = [];
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
               ballot.concat(uniqueID);

            newBallots.push(ballot);
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
