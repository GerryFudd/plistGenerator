var plist = require('plist'),
    addMethods = require('./addMethods'),
    makeOpenStepWithComments = require('./makeOpenStepWithComments');

module.exports = function PlistObject(text) {
  if (/(^<\?xml)/.test(text)) {
    console.log('parsingxml');
    return makeFromXML(text);
  } else {
    console.log('parsingOpenStep');
    return makeFromOpenStep(text);
  }
}

function makeFromOpenStep(text) {
  var openStepParser = require('./parseOpenStep/openStepParser.js');

  var result = {};

  result.plistData = openStepParser.parse(text);

  result = addMethods(result);

  result.build = function() {
    return makeOpenStepWithComments(this.plistData);
  }

  return result;
}

function makeFromXML(text) {

  var result = {};

  result.plistData = plist.parse(text);

  result = addMethods(result);

  result.build = function() {
    return plist.build(this.plistData);
  }

  return result;
}
