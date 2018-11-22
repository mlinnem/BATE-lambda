var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});

var ddb = new AWS.DynamoDB({apiVersion: '2018-10-01'});

exports.handler = (event, context, callback) => {
    //TODO: Change to pull all messages off queue every 10 seconds or minute.
    console.log("event...");
    console.log(event);
    console.log("record 0...");
    console.log(event.Records[0]);
    getAllAnimals()
    .then((allAnimals) => {
        console.log("All animals");
        console.log(allAnimals);
        for (let ballot of event.Records) {
        //TODO: Make this one bulk IO operation.
        console.log("A record...");
        console.log(ballot);
        var winnerID = parseInt(ballot.messageAttributes.Winner.stringValue)
        var loserID = parseInt(ballot.messageAttributes.Loser.stringValue);
        allAnimals = addWinTo(winnerID, allAnimals);
        allAnimals = addLossTo(loserID, allAnimals);
        }
        return allAnimals;
    })
    .then(putAllAnimals);
};

function addWinTo(animalID, allAnimals) {
    console.log("all animals");
    console.log(allAnimals);
    console.log("all animals item");
    console.log(allAnimals.Item);
    console.log("all animals item animals");
    console.log(allAnimals.Item.Animals);
    console.log("all animals item animals m ");
    console.log(allAnimals.Item.Animals.M);
    console.log("all animals items animals m animal ID");
    console.log(allAnimals.Item.Animals.M[animalID]);
     console.log("all animals items animals m animal ID m");
    console.log(allAnimals.Item.Animals.M[animalID].M);
     console.log("all animals items animals m animal ID m wins");
    console.log(allAnimals.Item.Animals.M[animalID].M.Wins);
     console.log("all animals items animals m animal ID m wins N");
    console.log(allAnimals.Item.Animals.M[animalID].M.Wins.N);
    allAnimals.Item.Animals.M[animalID].M.Wins.N = (parseInt(allAnimals.Item.Animals.M[animalID].M.Wins.N) + 1).toString();
    return allAnimals;

}

function addLossTo(animalID, allAnimals) {
   allAnimals.Item.Animals.M[animalID].M.Losses.N = (parseInt(allAnimals.Item.Animals.M[animalID].M.Losses.N) + 1).toString();
   return allAnimals;

}

function getAllAnimals() {
  var get_params = {
  Key: {
   "ID": {
       //TODO: This should probably be a number? In table.
     S: "0",
    },
  },
  TableName: "AllAnimals"
 };

 var request = ddb.getItem(get_params);
 var promise = request.promise();
 return promise;
}

function putAllAnimals(allAnimals){
 var put_params = {
  Item: allAnimals.Item,
  TableName: 'AllAnimals'
 };
 var request = ddb.putItem(put_params);
 var promise = request.promise();
 return promise;
}
