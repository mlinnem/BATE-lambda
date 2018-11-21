var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});

var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});

exports.handler = (event) => {
    //TODO: Limit
    console.log("Here's the event");
    console.log(event);
    var authkey = event["queryStringParameters"]['authkey'];
    console.log("Count is ");
  console.log(ballotRequestCount);
    return getAnimalsAndSession()
    .then(getAnimalCount)
    .then((animalCount_and_session) => {
        var animalCount = animalCount_and_authkey[0]
        var session = animalCount_and_session[1];
        var ballots = [];

        var ballotRequestCount = calculateBallotsToProvide(session);
        for (var i=0; i < ballotRequestCount; i++) {
            var animal_1_num = 0;
            var animal_2_num = 0;
            var iters = 0
            while ((animal_1_num == animal_2_num)) {
                //TODO: This will become a problem if the valid ID list is ever sparse (i.e. we remove an ID).
                animal_1_num = getRandomInt(0, animalCount - 1);
                if (animal_1_num > 0) {
                    animal_2_num = animal_1_num - 1;
                } else {
                    animal_2_num = animal_1_num;
                }
                if (getRandomInt(0, 1) == 0) {
                    //SWAP
                    var temp = animal_1_num;
                    animal_1_num = animal_2_num;
                    animal_2_num = temp;
                }
                iters++;
                if (iters > 50) {
                    console.error("Infinite loop. Bail out!");
                    return;
                }
            }
            var ballot = [animal_1_num, animal_2_num];
            ballots.push(ballot);
        }
        console.log(ballots);
        return ballots;
    })
    .then((ballots) => {

        const response = {
            "statusCode": 200,
            "isBase64Encoded": false,
            "headers": {"Access-Control-Allow-Headers": '*',
                      "Access-Control-Allow-Origin": '*',
                      "Access-Control-Allow-Methods": '*' },
            "body": JSON.stringify(ballots),
        };
        console.log("RESPONSE");
        console.log(response);
        return response;
    });
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
 return promise;
}


function getAnimalCount(animalsAndAuthkey) {
  var animals = animalsAndAuthkey[0];
  var authkey = animalsAndAuthkey[1];
  console.log("Animals are");
  console.log(animals);
  var animalMap = animals.Item.Animals.M;
  console.log(animalMap);
  var count = Object.keys(animalMap).length;
  console.log("count is ");
  console.log(count);
  return [count, authkey];
}

function getAnimalsAndSession(authkey) {
    return Promise.all(getAnimals(), getSession(authkey));
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
 return promise;
}

function calculateBallotsToProvide(session) {
  return 15 - session.PendingBallots.length;
}
