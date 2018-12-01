var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

var io = new AWS.DynamoDB.DocumentClient({apiVersion: '2018-10-01'});

exports.handler =  (event) => {
    console.log("Event up in here.");
    console.log(event);
    var response = getAnimals()
    .then((animalsResponse) => {
      console.log("ARRRRRR");
      console.log(animalsResponse);
      var sortedAnimals = rankAnimals(animalsResponse.Item.Animals);
    const response = {
        statusCode: 200,
        headers: {"Access-Control-Allow-Origin" : "*",
        "Access-Control-Allow-Methods" : "*",
        "Access-Control-Allow-Headers" : "*"},
        body: JSON.stringify(sortedAnimals)
    };
    console.log("response:");
    console.log(response);
    return response;
    });
    return response;
};

function getAnimals() {
  var get_params = {
  Key: {
   "ID": "0"
  },
  TableName: "AllAnimals"
 };

 return io.get(get_params).promise();
}

function rankAnimals(animalsMap) {
  console.log("RANK ANIMALS");
  console.log(animalsMap);
    var animalKeys = Object.keys(animalsMap);
    var animals = [];
    for (let animalKey of animalKeys) {
      console.log("X");
      var animal = animalsMap[animalKey];
      animal.ID = animalKey;
      animals.push(animal);
    }
      animals.sort(function (a, b) {
      var ratio_animal_a = (a.Wins + 1) / (a.Losses + 1);
      var ratio_animal_b = (b.Wins + 1) / (b.Losses + 1);
      console.log("ratio_animal_a:");
      console.log(ratio_animal_a);
      console.log("ratio_animal_b:");
      console.log(ratio_animal_b);
      if (ratio_animal_a == ratio_animal_b) {
        var alphabeticalOrder = [a.Name, b.Name].sort();
        if (alphabeticalOrder[0] == a.Name) {
          console.log("-1");
          return -1;
        } else {
          console.log("1");
          return 1;
        }
      } else {
        if (ratio_animal_b > ratio_animal_a) {
          console.log("1");
          return 1;
        } else if (ratio_animal_b < ratio_animal_a) {
          console.log("-1");
          return -1;
        } else {
          console.log("0");
          return 0;
        }
      }
    });
    return animals;
}
