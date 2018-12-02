
const SHADOW_BANNED = "SHADOW_BANNED";
const SHADOWBAN_SUBMISSION_THRESHOLD = 800
const ACCEPTABLE_ABANDON_RATE = .8;
const ACCEPTABLE_CONTRARIAN_RATE = .8;
const WATCH_LISTED = "WATCH_LISTED";
const BALLOT_ABANDONER = "BALLOT_ABANDONER";
const CONTRARIAN = "CONTRARIAN";

//{ Records:
//[ { EventSource: 'aws:sns',
//EventVersion: '1.0',
//EventSubscriptionArn: 'arn:aws:sns:us-east-1:395179212559:successfulBallotSubmission:d8ee0c84-2baf-4cc0-a826-6bdb11561b2d',
//Sns: [Object] } ] }

//{ Type: 'Notification',
//MessageId: 'f6b3ff52-c254-512c-8026-ab2cd836d1c6',
//TopicArn: 'arn:aws:sns:us-east-1:395179212559:successfulBallotSubmission',
//Subject: null,
//Message: '{"SessionID":"5U2v+PDvHYbOSGruh1RNgZ/S8OLyJ6Ms","IPAddress":"70.115.134.72","WinnerID":0,"LoserID":1}',
//Timestamp: '2018-12-02T17:36:34.774Z',
//SignatureVersion: '1',
//Signature: 'T0e5+j1JtcUjlF3MGaGGDKTgCT9FzwLL0kDoaSsdqeZU0gMOqnOOv09nOtbHq5N+cynKte9BbEv7YWHeuUEnxZ3oAGAerOptoH8SnZ5RIPzDqwoY4nz+eis+K+IiZLWYvLH3W/QyN61+oJooRYibcZ8fiXUyW+MvmASVULaXTt54lW6bL8Xuy/DVcC7u2b+BooRjLP9N2Pbcjix16ieQVP7FymHGGzcT5T5Jaz8O11bltZ5MHWcW7wxVocZAetRXBFC3bkQXrwxijKAFa52tf3Ck76C2t7hByUkpiNOv2T+TJBCzs2brAujZfxhT5vONfrApDRvymAvEvuCn6RxYfQ==',
//SigningCertUrl: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-ac565b8b1a6c5d002d285f9598aa1d9b.pem',
//UnsubscribeUrl: 'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:395179212559:successfulBallotSubmission:d8ee0c84-2baf-4cc0-a826-6bdb11561b2d',
//MessageAttributes: {} }

var AWS = require('aws-sdk');
// Set the region
AWS.config.update({
  region: 'us-east-1'
});
var io = new AWS.DynamoDB.DocumentClient({
apiVersion: '2018-10-01'
});

//TODO: Make sure bogus ballots aren't triggering this process.
exports.handler = async (event) => {
    // TODO implement
    console.log("IM RUNNING YAY!");
    console.log("event:");
    console.log(event);
    var sns = event.Records[0].Sns;
    console.log("sns:");
    console.log(sns);
    var message = JSON.parse(sns.Message);
    console.log("message:");
    console.log(message);

    var sessionID = message.SessionID;
    var ipAddress = message.IPAddress;
    var winnerID = message.WinnerID;
    var loserID = message.LoserID;

    await updateIPData(ipAddress, winnerID, loserID);

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};


async function updateIPData(ipAddress, winnerID, loserID) {

    var ipData = backend_getIPData(ipAddress);

    //If not on watch list
    if (ipData.status != SHADOW_BANNED && ipData.status != WATCH_LISTED) {
        //Just implement submissionCount
        console.log("NOTHING SPECIAL. INCREMENTING SUBMISSION COUNT");
        await backend_updateForNormalIP(ipAddress);
    }

    //If already on watch list
        //Plan to increment submissionCount contrarian or non-contrarian count, and non-abandoned ballot count.

    //Increment what needs incrementing, and get new results.
    //If not on watch list
        //If meet criteria for watch list
            //Add to watch list.
    //Else
        //If meet criteria
            //Add to shadowban list.


}

function backend_getIPData(ipAddress) {
  var get_params = {
  Key: {
   "IPAddress": ipAddress
  },
  TableName: "IPData"
 };

 return io.get(get_params).promise()
 .then((ipData) => {
   console.log("GOT IP Data");
   console.log(ipData);
 });
}

function backend_updateForNormalIP(ipAddress) {
    var updateParams = {
    "TableName": "IPData",
    "Key": {
      "IPAddress": ipAddress
    },
    "UpdateExpression": 'ADD Submissions :s_inc',
    "ExpressionAttributeValues": {
      ":s_inc": 1,
    },
  };

  return io.update(updateParams).promise()
  .then((result) => {
      console.log("result of update:");
      console.log(result);
  })
  .catch((error) => {
      console.log("Error on update!");
      console.log(error);
  });
}


// function updateIPData(ipData, ballot) {
//   return backend_incrementAndGetIPData(context.ipAddress, context.ballot)
//     .then((ipData) => {
//       //TODO: These can really be parallelized if we want.
//       return addToShadowbanListIfWarranted(ipData);
//     });
// }

// function backend_incrementIPData(ipAddress, isContrarian) {
//   var contrarianIncrement = 0;
//   var nonContrarianIncrement = 0;
//   if (isContrarian) {
//     contrarianIncrement = 1;
//   } else {
//     nonContrarianIncrement = 1;
//   }

//   //TODO: Need to create table row in the first place if it doesn't exist.
//   //Should work according to dynamodb docs but not certain

//   var updateParams = {
//     "TableName": "IPData",
//     "Key": {
//       "IPAddress": ipAddress
//     },
//     "UpdateExpression": 'SET Submissions = Submissions + :s_inc, ContrarianSubmissions = ContrarianSubmissions + :c_inc, NonContrarianSubmissions = NonContrarianSubmissions + :n_inc, BallotsNotAbandoned = BallotsNotAbandoned + :b_inc',
//     "ExpressionAttributeValues": {
//       "s_inc": 1,
//       "c_inc": contrarianIncrement,
//       "n_inc": nonContrarianIncrement,
//       "b_inc": 1
//     },
//     "ReturnValues": "ALL_NEW"
//   }

//   return io.update(updateParams).promise()
//     .then((result) {
//         console.log("result of updated IP data");
//         console.log(result);
//         if (isShadowBanWorthy(result)) {
//           backend_setIPToShadowban(ipAddress);
//         }
//       }

// function backend_shadowBanIfNeeded(ipData) {
//       console.log("updateToIPAddressStuff:");
//       console.log(ipData);

//       var submissionCount = 0;
//       var contrarianSubmissions = 0;
//       var nonContrarianSubmissions = 0;
//       var ballotsAbandoned = 0;
//       var ballotsNotAbandoned = 0;

//       if (submissionCount > SHADOWBAN_SUBMISSION_THRESHOLD) {
//         var abandonRate = ballotsAbandoned / (ballotsAbandoned + ballotsNotAbandoned);
//         var contrarianRate = contrarianSubmissions / (contrarianSubmissions + nonContrarianSubmissions);

//         var newStatus = WATCH_LISTED;
//         var reason = null;
//         if (abandonRate > ACCEPTABLE_ABANDON_RATE) {
//           newStatus = SHADOW_BANNED;
//           reason = BALLOT_ABANDONER;
//         } else if (contrarianRate > ACCEPTABLE_CONTRARIAN_RATE) {
//           newStatus = SHADOW_BANNED;
//           reason = CONTRARIAN;
//         }

//         if (newStatus == SHADOW_BANNED) {
//           return backend_setIPTOShadowban(ipAddress, reason);
//         }
//       }
//     }
