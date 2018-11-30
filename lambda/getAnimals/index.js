var AWS = require('aws-sdk');
// Set the region
var uploadWorked = true;

AWS.config.update({region: 'us-east-1'});

var io = new AWS.DynamoDB.DocumentClient({apiVersion: '2018-10-01'});

function rankAnimals(animalsMap) {
    var animalKeys = Object.keys(animalsMap);
    var animals = [];
    for (let animalKey of animalKeys) {
      var animal = animalsMap[animalKey];
      animal.ID = animalKey;
      animals.push(animal);
    }
    var result = animals.sort(function (a, b) {
      var ratio_animal_a = (a.Wins + 1) / (a.Losses + 1);
      var ratio_animal_b = (b.Wins + 1) / (b.Losses + 1);
      if (ratio_animal_a == ratio_animal_b) {
        var alphabeticalOrder = [a.Name, b.Name].sort();
        if (alphabeticalOrder[0] == a.Name) {
          return -1;
        } else {
          return 1;
        }
      } else {
        if (ratio_animal_b > ratio_animal_a) {
          return 1;
        } else if (ratio_animal_b < ratio_animal_a) {
          return -1;
        } else {
          return 0;
        }
      }
    });
    var animalsIDSorted = animals.map(function(animal) {return animal.ID});
    return animalsIDSorted;
}
exports.handler =  (event) => {
    console.log("Event up in here.");
    console.log(event);
    var response = getAnimals()
    .then((animalsResponse) => {
    const response = {
        var sortedAnimals = sortAnimals(animalsResponse.Item);
        statusCode: 200,
        headers: {"Access-Control-Allow-Origin" : "*",
        "Access-Control-Allow-Methods" : "*",
        "Access-Control-Allow-Headers" : "*"},
        body: JSON.stringify(sortedAnimals)
    };
    return response;
    });
    return response;
};

function getAnimals() {
  var get_params = {
  Key: {
   "ID": 0
  },
  TableName: "AllAnimals"
 };

 return io.get(get_params).promise();
}

function rankAnimals(animalsMap) {
    var animalKeys = Object.keys(animalsMap);
    var animals = [];
    for (let animalKey of animalKeys) {
      var animal = animalsMap[animalKey];
      animal.ID = animalKey;
      animals.push(animal);
    }
    var result = animals.sort(function (a, b) {
      var ratio_animal_a = (a.Wins + 1) / (a.Losses + 1);
      var ratio_animal_b = (b.Wins + 1) / (b.Losses + 1);
      if (ratio_animal_a == ratio_animal_b) {
        var alphabeticalOrder = [a.Name, b.Name].sort();
        if (alphabeticalOrder[0] == a.Name) {
          return -1;
        } else {
          return 1;
        }
      } else {
        if (ratio_animal_b > ratio_animal_a) {
          return 1;
        } else if (ratio_animal_b < ratio_animal_a) {
          return -1;
        } else {
          return 0;
        }
      }
    });
    return animals;
}
