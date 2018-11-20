var AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: 'us-east-1'});

var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});

exports.handler = (event) => {
    //TODO: Limit
    console.log("Here's the event");
    console.log(event);
    var ballotRequestCount = event["queryStringParameters"]['count'];
    return getAnimalTable()
    .then(getAnimalCount)
    .then((animalCount) => {
        var ballots = [];
        for (var i=0; i < ballotRequestCount; i++) {
            var animal_1_num = 0;
            var animal_2_num = 0;
            var iters = 0
            while ((animal_1_num == animal_2_num)) {
                //TODO: This will become a problem if the valid ID list is ever sparse (i.e. we remove an ID).
                animal_1_num = getRandomInt(0, animalCount - 2);
                animal_2_num = getRandomInt(0, animalCount - 2);
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

function getAnimalTable() {
    var params = {
  TableName: "AllAnimals"
 };
 
 return ddb.describeTable(params).promise();
}
function getAnimalCount(animalTable) {
    return animalTable.Table.ItemCount;
}
