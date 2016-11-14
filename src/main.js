//imports
var fs = require("fs");
var request = require("sync-request");

//constants
var userID = "5004";
var ringerModes = ['loud', 'vibrate', 'silent'];
var baseURL = "http://yangtze.csc.ncsu.edu:9090/csc555sd/services.jsp?";
var callTypes = {
  urgent: 2.0,
  casual: 1.0,
  none: 0.25
};
var stayCount = 1;

var relationshipTypes = {};
parseRelationshipTypes();
// console.log(relationshipTypes);

var relationships = {};
var relationshipIDs = {};
parseRelationships();
// console.log(relationships);

var places = {};
parsePlaces();
// console.log(places);

setInterval(function() { //run the simulate visits and sending feedbacks every 45 seconds
  simulateVisits();
  sendFeedbacks();
}, 45);

function simulateVisits() {
  for (var place in places) {
    console.log("Entering " + place + ".");
    enter(place);

    for (var i = 1; i <= stayCount; i++) {
      console.log("Getting all neighbors in " + place + ".");
      var neighbors = listNeighbors();

      var call = requestCall();
      console.log("Got call from " + call.callerName + ".");

      var decidedResponse = calculateSocialBenefit(neighbors, call, place);

      console.log("Ringer manager responded with mode " + decidedResponse.response + ".");
      console.log("Rationale is: " + decidedResponse.rationale + ".");
      respondToCall(call, decidedResponse);
    }

    exit(place);
    console.log("Exiting " + place + ".\n");
    // break;
  }

  // console.log("Relationships at the end of iteration: ");
  // console.log(relationships);
}

function sendFeedbacks() {
  for (var place in places) {
    console.log("Entering " + place + " for feedbacks.");
    enter(place);

    var requestURL = baseURL + "action=getCallsInCurrentPlace&userId=" + userID;
    var res = request('GET', requestURL, {});
    res = (JSON.parse(res.body));
    for (var call of res.calls) {
      if (call.calleeId == userID || !call || userID == call.callerId)
        continue;
      var caller = relationshipIDs[call.callerId];
      call.callerName = caller.name;
      var response = calculateSocialBenefit(listNeighbors(), call, res.place);
      var feedback1, feedback2;
      if (call.ringermode == "null") { //neutral for null ringer modes
        feedback1 = "neutral";
        feedback2 = "neutral";
      }
      else if (call.ringermode.toLowerCase() == response.response) { //if the ringer mode was the same as I thought, then feedbacks will be positive
        feedback1 = "positive";
        feedback2 = "positive";
      }
      else { //otherwise see what caused the response to be different, and accordingly update norms
        feedback1 = "negative";
        feedback2 = "negative";
        var rationale = call.rationale;
        if (rationale == "null") {
          feedback2 = "neutral";
          continue;
        }
        if (rationale.indexOf("ArgInFav(") != -1 && rationale.indexOf("ArgInOpp(") == -1) {
          if (rationale.indexOf("caller-relationship-IS-") != -1) {
            var relationshipIndex = rationale.indexOf("caller-relationship-IS-") + 24;
            var relationship = rationale.substring(relationshipIndex, relationshipIndex + 1);
            var callReasonIndex = rationale.indexOf("caller-reason-IS-") + 18;
            var callReason = rationale.substring(callReasonIndex, callReasonIndex + 7);
            if (callReason.indexOf("urgent") != -1) {
              feedback2 = "positive";
              if ((call.ringermode.toLowerCase() == "vibrate" && response.response == "loud") || (call.ringermode.toLowerCase() == "silent" && response.response == "vibrate")) {
                var relationshipName = Object.keys(relationshipTypes)[relationship];
                relationshipTypes[relationshipName] -= 0.1;
              }
              else if ((call.ringermode.toLowerCase() == "vibrate" && response.response == "silent") || (call.ringermode.toLowerCase() == "loud" && response.response == "vibrate")) {
                var relationshipName = Object.keys(relationshipTypes)[relationship];
                relationshipTypes[relationshipName] += 0.1;
              }
            }
          }
        }
      }
      console.log("Giving feedback for call ID " + call.callId + ": " + feedback1 + ", " + feedback2);
      requestURL = baseURL + "action=giveFeedback&callId=" + call.callId + "&userId=" + userID + "&feedback=" + feedback1 + "&feedbackUpdated=" + feedback2;
      res = request('GET', requestURL, {});
      console.log(JSON.parse(res.body));
    }

    exit(place);
    console.log("Exiting " + place + " for feedbacks.\n");
  }
}

function respondToCall(call, decidedResponse) {
  var requestURL = baseURL + "action=responseCall&callId=" + call.callId + "&ringerMode=" + decidedResponse.response + "&rationale=" + decidedResponse.rationale;
  var res = request('GET', requestURL, {});

  requestURL = baseURL + "action=listFeedbacks&callId=" + call.callId;
  res = request('GET', requestURL, {});
  var feedback = (JSON.parse(res.body));

  for (var user of feedback.feedbacks) {
    if (relationshipIDs[user.id]) {
      switch (user.feedback) {
        case 'positive':
          if (relationshipIDs[user.id].lastExpected !== decidedResponse.response) //if the guy gave positive feedback, but he had a different expectation than my response, he is not predictable - reduce his contribution factor  
            relationships[relationshipIDs[user.id].name].weight -= 0.05;
          break;
        case 'negative':
          if (relationshipIDs[user.id].lastExpected === decidedResponse.response) //if the guy gave negative feedback, but he had the same expectation as my response, he is not predictable - reduce his contribution factor
            relationships[relationshipIDs[user.id].name].weight -= 0.1;
          else
            relationships[relationshipIDs[user.id].name].weight += 0.1; //if the guy gave negative feedback, but he had a different expectation than my response, give him a better chance next time to contribute to the final decision
          break;
        case 'neutral':
          relationships[relationshipIDs[user.id].name].weight -= 0.01; //neutral response denotes he should not have that much effect in deciding the response
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
  var responseRationale = {
    loud: [],
    silent: [],
    vibrate: []
  };

  for (var neighbor of neighbors) { //iterate over all neighbors
    var weight, option;

    option = neighbor.expected.toLowerCase(); //neighbor's expected ringer mode
    relationshipIDs[neighbor.id] = {
      name: neighbor.name,
      lastExpected: option
    }

    if (call.callerId == neighbor.id) {
      call.callerName = neighbor.name;
    }

    if (!relationships.hasOwnProperty(neighbor.name)) { //insert this in the relationship object if it is not already there
      relationships[neighbor.name] = {
        relationship: "stranger",
        weight: relationshipTypes["stranger"]
      }
    }
    weight = relationships[neighbor.name].weight; //this is how significant this guy's expectations are to my ringer mode selection
    responseOptions[option] += weight; //the weight is multiplied with a relationship type weight, i.e. for family, their contribution would be more than strangers
  }

  var majority = findMax(responseOptions);
  responseRationale[majority].push("Majority(expected_mode)-IS-" + majority); //weighted majority says this is the expected ringer mode

  reactToPlaces(responseOptions, place, responseRationale);
  response = findMax(responseOptions);

  switch (response) { //if the response is silent or vibrate, accordingly accommodate the urgency of the call
    case 'silent':
      responseOptions["vibrate"] += relationshipTypes[relationships[call.callerName].relationship] * callTypes[call.reason] * 2;
      responseRationale["vibrate"].push("caller-relationship-IS-" + (Object.keys(relationshipTypes).indexOf(relationships[call.callerName].relationship) + 1)); //caller relationship and response rationale
      responseRationale["vibrate"].push("call-reason-IS-" + call.reason);
      break;
    case 'vibrate':
      responseOptions["loud"] += relationshipTypes[relationships[call.callerName].relationship] * callTypes[call.reason];
      responseRationale["loud"].push("caller-relationship-IS-" + (Object.keys(relationshipTypes).indexOf(relationships[call.callerName].relationship) + 1));
      responseRationale["loud"].push("call-reason-IS-" + call.reason);
      break;
  }

  response = findMax(responseOptions); //decide the actual response

  console.log("Options are: " + JSON.stringify(responseOptions));
  var rationale = "ArgInFav(ringermode-IS-" + response + "+WHEN+" + responseRationale[response].join("+AND+") + ")"
  return {
    response: response,
    rationale: rationale
  };
}

//the place also has an effect
function reactToPlaces(responseOptions, place, responseRationale) {
  var noise = places[place];
  if (noise <= 2) {
    responseOptions["silent"] += 0.5;
    responseRationale["silent"].push("place-IS-" + place); //place and noise leve rationale
    responseRationale["silent"].push("noise-IS-" + noise);
  }
  else if (noise <= 7) {
    responseOptions["vibrate"] += 0.5;
    responseRationale["vibrate"].push("place-IS-" + place);
    responseRationale["vibrate"].push("noise-IS-" + noise);
  }
  else {
    responseOptions["loud"] += 0.5;
    responseRationale["loud"].push("place-IS-" + place);
    responseRationale["loud"].push("noise-IS-" + noise);
  }
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
    var relationship = temp[2].toLowerCase();
    var weight = relationshipTypes[relationship];
    relationships[temp[1]] = {
      relationship: relationship,
      weight: weight
    }
    relationshipIDs[temp[0]] = {
      name: temp[1],
      lastExpected: ""
    }
  }
}

//get a list of places and their noise levels there
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