var _ = require('lodash');

module.exports = function makeOpenStepWithComments(plistData) {
  return '// !$*UTF8*$!\n' +
    makeStringFromDataStructure(plistData, 0, makeUuidComments(plistData.objects)) +
    '\n\r';
}

function makeStringFromDataStructure(plistData, indentations, uuidComments, noNewLine) {
  var result = '';
  var type = getDataStructure(plistData);
  if (type === 'dict') {
    var isMultiLine = !noNewLine && ['PBXBuildFile', 'PBXFileReference'].indexOf(plistData.isa) < 0;
    result += '{';
    Object.keys(plistData).forEach(function(key) {
      if (getDataStructure(plistData[key]) === 'undefined') {
        return;
      }
      if (key === 'objects') {
        result += '\n' + makeIndentations(indentations + 1) + 'objects = {\n';
        result += makeObjectsString(plistData.objects, indentations + 1, uuidComments);
        result += '\n' + makeIndentations(indentations + 1) + '};';
      } else if (isMultiLine){
        if (getDataStructure(key) === 'uuid') {
          result += '\n' + makeIndentations(indentations + 1) + uuidComments[key] + ' = ';
        } else {
          result += '\n' + makeIndentations(indentations + 1) + key + ' = ';
        }

        result += makeStringFromDataStructure(plistData[key], indentations + 1, uuidComments) + ';';
      } else {
        result += key + ' = ' + makeStringFromDataStructure(plistData[key], indentations + 1, uuidComments, true) + '; ';
      }
    });
    if (isMultiLine) {
      result += '\n' + makeIndentations(indentations);
    }
    result += '}';
  } else if (type === 'array') {
    result += '(';
    if (!noNewLine) {
      result += '\n';
    }
    result += plistData.map(function(datum) {
      if (noNewLine) {
        return makeStringFromDataStructure(datum, indentations + 1, uuidComments, true) + ', ';
      }

      return makeIndentations(indentations + 1) + makeStringFromDataStructure(datum, indentations + 1, uuidComments) + ',\n';
    }).join('');
    if (!noNewLine) {
      result += makeIndentations(indentations);
    }

    result += ')';
  } else if (type === 'uuid') {
    result += uuidComments[plistData];
  } else if (type === 'boolean') {
    result += plistData ? 'YES' : 'NO';
  } else if (type === 'other') {
    result += plistData;
  }

  return result;
}

function makeObjectsString(plistData, indentations, uuidComments) {
  var result = '';
  var sections = Object.keys(plistData).reduce(function(acc, uuid) {
    if (acc.hasOwnProperty(plistData[uuid].isa)) {
      return Object.assign(acc, {
        [plistData[uuid].isa]: acc[plistData[uuid].isa].concat([uuid])
      });
    }

    return Object.assign(acc, { [plistData[uuid].isa]: [uuid]});
  }, {});
  Object.keys(sections)
    .sort()
    .forEach(function(section, index) {
      if (index !== 0) {
        result += '\n';
      }
      result += '/* Begin ' + section + ' section */\n';
      result += sections[section].map(function(uuid) {
        return makeIndentations(indentations + 1) + uuidComments[uuid] + ' = ' +
          makeStringFromDataStructure(plistData[uuid], indentations + 1, uuidComments) +
          ';\n';
      }).join('');
      result += '/* End ' + section + ' section */\n';
    });
  return result;
}

function getDataStructure(data) {
  switch(typeof(data)) {
    case 'object':
      if (data === null) {
        return 'undefined';
      }

      if (Array.isArray(data)) {
        return 'array';
      }

      return 'dict';
    case 'string':
      if (data.length === 24 && /[0-9][A-Z]/.test(data)) {
        return 'uuid';
      }

      return 'other';
    case 'undefined':
      return 'undefined';
    case 'boolean':
      return 'boolean';
    default:
      return 'other';
  }
}

function makeUuidComments(data) {
  var nativeTargetUuid = _.find(Object.keys(data), function(uuid) {
    return data[uuid].isa === 'PBXNativeTarget';
  });

  var productName = data[nativeTargetUuid].productName;

  return Object.keys(data).reduce(function(acc, uuid, ind, array) {
    if (data[uuid].isa === 'PBXProject') {
      return Object.assign(acc, { [uuid]: uuid + ' /* Project object */'});
    }

    if (data[uuid].isa === 'PBXTargetDependency') {
      return Object.assign(acc, { [uuid]: uuid + ' /* PBXTargetDependency */'});
    }

    if (data[uuid].isa === 'PBXContainerItemProxy') {
      return Object.assign(acc, { [uuid]: uuid + ' /* PBXContainerItemProxy */'});
    }

    if (data[uuid].name) {
      return Object.assign(acc, { [uuid]: uuid + ' /* ' + data[uuid].name.replace(/"/g, '') + ' */'});
    }

    if (data[uuid].path) {
      return Object.assign(acc, { [uuid]: uuid + ' /* ' + data[uuid].path.replace(/"/g, '')  + ' */'});
    }

    if (data[uuid].fileRef) {
      var name = data[data[uuid].fileRef].name ? data[data[uuid].fileRef].name : data[data[uuid].fileRef].path;
      if (!name || typeof(name) !== 'string') {
        return Object.assign(acc, { [uuid]: uuid });
      }

      var container = _.find(array, function(item) {
        return /^PBX[A-Za-z]+BuildPhase$/.test(data[item].isa) &&
          (_.has(data[item], 'files') && data[item].files.indexOf(uuid) > -1);
      });

      if (container && data[container].isa) {
        return Object.assign(acc, { [uuid]: uuid + ' /* ' + name.replace(/"/g, '') + ' in ' + data[container].isa.slice(3, -10) + ' */' });
      }

      container = _.find(array, function(item) {
        return _.has(data[item], 'name') &&
          (_.has(data[item], 'children') && data[item].children.indexOf(data[uuid].fileRef) > -1);
      });

      if (container && data[container].name) {
        return Object.assign(acc, { [uuid]: uuid + ' /* ' + name.replace(/"/g, '') + ' in ' + data[container].name.replace(/"/g, '') + ' */' });
      }
    }

    if (/^PBX[A-Za-z]+BuildPhase$/.test(data[uuid].isa)) {
      var name = data[uuid].isa.slice(3, -10);
      return Object.assign(acc, { [uuid]: uuid + ' /* ' + name + ' */' });
    }

    if (data[uuid].isa === 'XCConfigurationList') {
      return Object.assign(acc, { [uuid]: uuid + ' /* Build configuration list for PBXProject "' + productName + '" */' });
    }

    return Object.assign(acc, { [uuid]: uuid });
  }, {});
}

function makeIndentations(number) {
  var result = '';
  for (n = 0; n < number; n++) {
    result += '\t';
  }
  return result;
}
