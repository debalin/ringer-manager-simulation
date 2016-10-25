//imports
var fs = require("fs");
var request = require("sync-request");

//constants
var userID = "5004";
var ringerModes = ['loud', 'vibrate', 'silent'];
var baseURL = "http://yangtze.csc.ncsu.edu:9090/csc555/services.jsp?";
var callTypes = {
  urgent: 0.7,
  casual: 0.2,
  none: 0.1
};

var relationships = {};
var relationshipIDs = {};
parseRelationships();
// console.log(relationships);

var places = {};
parsePlaces();
// console.log(places);

var relationshipTypes = {};
parseRelationshipTypes();
// console.log(relationshipTypes);

simulateVisits();

function simulateVisits() {
  for (var place in places) {
    console.log("Entering " + place + ".");
    enter(place);

    console.log("Getting all neighbors in " + place + ".");
    var neighbors = listNeighbors();

    var call = requestCall();
    console.log("Got call from " + call.callerName + ".");

    var decidedResponse = calculateSocialBenefit(neighbors, call, place);

    console.log("Ringer manager responded with mode " + decidedResponse + ".");
    respondToCall(call, decidedResponse);

    exit(place);
    console.log("Exiting " + place + ".\n");
  }

  console.log("Relationships at the end of iteration: ");
  console.log(relationships);
}

function respondToCall(call, decidedResponse) {
  var requestURL = baseURL + "action=responseCall&callId=" + call.callId + "&ringerMode=" + decidedResponse;
  var res = request('GET', requestURL, {});
  var feedback = (JSON.parse(res.body));

  for (var user of feedback.user) {
    if (relationshipIDs[user.id]) {
      switch (user.feedback) {
        case 'positive':
          if (relationshipIDs[user.id].lastExpected !== decidedResponse) //if the guy gave positive feedback, but he had a different expectation than my response, he is not predictable - reduce his contribution factor  
            relationships[relationshipIDs[user.id].name].weight -= 0.05;
          break;
        case 'negative':
          if (relationshipIDs[user.id].lastExpected === decidedResponse) //if the guy gave negative feedback, but he had the same expectation as my response, he is not predictable - reduce his contribution factor
            relationships[relationshipIDs[user.id].name].weight -= 0.1;
          else
            relationships[relationshipIDs[user.id].name].weight += 0.1; //if the guy gave negative feedback, but he had a different expectation than my response, give him a better chance next time to contribute to the final decision
          break;
        case 'neutral':
          relationships[relationshipIDs[user.id].name].weight -= 0.03; //neutral response denotes he should not have that much effect in deciding the response
          break;
      }
    }
  }
  // console.log(relationships);
  // console.log(feedback);
}

function calculateSocialBenefit(neighbors, call, place) {
  var response = "";
  var responseOptions = {
    loud: 0,
    silent: 0,
    vibrate: 0
  };

  for (var neighbor of neighbors) { //iterate over all neighbors
    var weight, option;

    option = neighbor.expected.toLowerCase(); //neighbor's expected ringer mode
    relationshipIDs[neighbor.id] = {
      name: neighbor.name,
      lastExpected: option
    }

    if (!relationships.hasOwnProperty(neighbor.name)) { //insert this in the relationship object if it is not already there
      relationships[neighbor.name] = {
        relationship: "stranger",
        weight: 1
      }
    }
    weight = relationships[neighbor.name].weight; //this is how significant this guy's expectations are to my ringer mode selection
    responseOptions[option] += weight * parseFloat(relationshipTypes[relationships[neighbor.name].relationship]); //the weight is multiplied with a relationship type weight, i.e. for family, their contribution would be more than strangers
  }

  responseOptions[places[place]] += responseOptions[places[place]] * 0.5; //the place also has an effect
  response = findMax(responseOptions);

  switch (response) { //if the response is silent or vibrate, accordingly accommodate the urgency of the call
    case 'silent':
      responseOptions["vibrate"] += relationshipTypes[relationships[call.callerName].relationship] * callTypes[call.reason];
      break;
    case 'vibrate':
      responseOptions["loud"] += relationshipTypes[relationships[call.callerName].relationship] * callTypes[call.reason];
      break;
  }

  response = findMax(responseOptions); //decide the actual response

  console.log("Options are: " + JSON.stringify(responseOptions));
  return response;
}

function findMax(responseOptions) {
  if (responseOptions.loud >= responseOptions.silent && responseOptions.loud >= responseOptions.vibrate)
    return "loud";
  else if (responseOptions.silent >= responseOptions.loud && responseOptions.silent >= responseOptions.vibrate)
    return "silent";
  else
    return "vibrate";
}

function requestCall() {
  var requestURL = baseURL + "action=requestCall&userId=" + userID;
  var res = request('GET', requestURL, {});
  // console.log(JSON.stringify(JSON.parse(res.body)));
  return (JSON.parse(res.body));
}

function listNeighbors() {
  var requestURL = baseURL + "action=getNeighbors&userId=" + userID;
  var res = request('GET', requestURL, {});
  // console.log(JSON.stringify(JSON.parse(res.body)));
  return (JSON.parse(res.body).user);
}

function enter(place) {
  var requestURL = baseURL + "action=enterPlace&place=" + place + "&userId=" + userID + "&myMode=" + ringerModes[getRandomInt(0, 3)] + "&expectedMode=" + ringerModes[getRandomInt(0, 3)];
  var res = request('GET', requestURL, {});
  // console.log("Entering " + " " + JSON.stringify(res));
}

function exit(place) {
  var requestURL = baseURL + "action=exitPlace&userId=" + userID;
  var res = request('GET', requestURL, {});
  // console.log("Exiting " + " " + JSON.stringify(res));
}

//get a list of relationships and their types, this should ideally be from a web service call
function parseRelationships() {
  var fileContent = fs.readFileSync("relationships.txt", "utf8").split("\r\n");
  for (var relationship of fileContent) {
    var temp = relationship.split(":");
    relationships[temp[0]] = {
      relationship: temp[1].toLowerCase(),
      weight: 1
    }
  }
}

//get a list of places and the default expected ringer mode there, this should ideally be from a web service call
function parsePlaces() {
  var fileContent = fs.readFileSync("places.txt", "utf8").split("\r\n");
  for (var place of fileContent) {
    var temp = place.split(":");
    places[temp[0]] = temp[1];
  }
}

//get a list of relationship types and their strength to this user (should add up to 1)
function parseRelationshipTypes() {
  var fileContent = fs.readFileSync("relationshipTypes.txt", "utf8").split("\r\n");
  for (var relationshipType of fileContent) {
    var temp = relationshipType.split(":");
    relationshipTypes[temp[0]] = parseFloat(temp[1]);
  }
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}