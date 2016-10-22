//imports
var fs = require("fs");
var request = require("request");

//constants
var userID = "5004";

var relationships = [];
parseRelationships();
console.log(relationships);
 
var places = {};
parsePlaces();
console.log(places);
  
var relationshipTypes = {};
parseRelationshipTypes();
console.log(relationshipTypes);

simulateVisits();

function simulateVisits() {
  for (var place in places) {

  }
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