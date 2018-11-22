var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});

exports.handler = (event) => {
    var authKey = event["queryStringParameters"]['authkey'];

    createBallots(authKey);
}

//--Main--

function createBallots(authKey) {
    return getAnimalsAndSession(authKey)
    .then(generateNewBallotsAndWriteToSession)
    .then(returnBallots);
};

function getAnimalsAndSession(authkey) {
    return Promise.all(getAnimals(), getSession(authkey));
}


function generateNewBallotsAndWriteToSession(animals_and_session) {
      var animals = animals_and_session[0]
      var session = animals_and_session[1];

      var newBallots = [];

      var animalCount = getAnimalCount(animals);

      var newBallotsNeeded = calculateBallotsToProvide(session);

      var newBallots = generateNewBallots(newBallotsNeeded, animalCount);
      writeNewBallotsToSession(newBallots, session);

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

function writeNewBallotsToSession(newBallots, session) {
  //TODO: This can maybe occur asynchronously with respect to just returning the ballots to the user.
  //BUT they have to be written before the user tries to submit the ballot, otherwise backend will think it's bogus.
    var updatedSession =  Object.assign({}, session, {PendingBallots" : session.PendingBallots.concat(newBallots)});

    var put_params = {
      Item: updatedSession,
      TableName: 'AuthKey_To_Ballots'
    };

    var request = ddb.putItem(put_params);
    var promise = request.promise();
    return promise;
}

function getAnimals() {
  var get_params = {
  Key: {
   "ID": {
     S: "0",
    },
  },
  TableName: "AllAnimals"
 };

 var request = ddb.getItem(get_params);
 var promise = request.promise();
 return promise.then(unmarshall);
}

function getSession(authkey) {
    var get_params = {
  Key: {
   "ID": {
     S: authkey,
    },
  },
  TableName: "AuthKey_To_Ballots"
 };

 var request = ddb.getItem(get_params);
 var promise = request.promise();
 return promise.then(unmarshall);
}

//--Utility functions--

function generateNewBallots(newBallotsNeeded, animalCount) {
        for (var i=0; i < newBallotsNeeded; i++) {
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
            }
            var ballot = [animal_1_num, animal_2_num];
            newBallots.push(ballot);
        }
        return newBallots;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateBallotsToProvide(session) {
  return 15 - session.PendingBallots.length;
}

function getAnimalCount(animals) {
  var animalMap = animals.Item.Animals.M;
  var count = Object.keys(animalMap).length;
  return count;
}

function marshall(object) {
  return AWS.DynamoDB.Converter.marshall(object);
}

function unmarshall(object) {
  return AWS.DynamoDB.Converter.unmarshall(object);
}
