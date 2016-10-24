//imports
var fs = require("fs");
var request = require("sync-request");

//constants
var userID = "5004";
var ringerModes = ['loud', 'vibrate', 'silent'];
var baseURL = "http://yangtze.csc.ncsu.edu:9090/csc555/services.jsp?";

var relationships = [];
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

    var decidedResponse = calculateSocialBenefit(neighbors, call);

    console.log("Ringer manager responded with mode " + decidedResponse + ".");
    respondToCall(call, decidedResponse);

    exit(place);
    console.log("Exiting " + place + ".\n");
  }
}

function respondToCall(call, decidedResponse) {
  var requestURL = baseURL + "action=responseCall&callId=" + call.callId + "&ringerMode=" + decidedResponse;
  var res = request('GET', requestURL, {});
  var feedback = (JSON.parse(res.body));
  console.log(feedback);
}

function calculateSocialBenefit(neighbors, call) {
  var response = "silent";

  return response;
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
    var temp1 = relationship.split(":");
    var temp2 = {};
    temp2[temp1[0]] = {
      relationship: temp1[1].toLowerCase()
    }
    relationships.push(temp2);
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