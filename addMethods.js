var _ = require('lodash'),
    uuid = require('node-uuid');

module.exports = function addMethods(object) {
  var result = Object.assign({}, object);

  // basic commands for finding and adding entries into the property list
  result.allUuids = allUuids.bind(result);
  result.generateUuid = generateUuid.bind(result);
  result.findObject = findObject.bind(result);
  result.addDict = addDict.bind(result);

  // commands that add a property and its reference in some parent property
  result.addFileReferenceToParent = addFileReferenceToParent.bind(result);
  result.addGroupToParent = addGroupToParent.bind(result);
  result.addChildToParent = addChildToParent.bind(result);
  result.setProvisioningStyle = setProvisioningStyle.bind(result);

  // add build phases
  result.addBuildPhase = addBuildPhase.bind(result);
  result.addShellScript = addShellScript.bind(result);

  // add files that need search paths and appropriate parend properties
  result.addFrameworkFile = addFrameworkFile.bind(result);
  result.addLibraryFile = addLibraryFile.bind(result);

  return result;
}

// returns list of uuids for all properties
function allUuids() { return Object.keys(this.plistData.objects); }

// create a new uuid that is unique and matches the pattern that xcode requires
function generateUuid() {
    var id = uuid.v4()
        .replace(/-/g, '')
        .substr(0, 24)
        .toUpperCase()

    if (this.allUuids().indexOf(id) >= 0) {
        return this.generateUuid();
    } else {
        return id;
    }
}

// returns the first object that matches the entered searchParams
// the searchParams can take the following forms
//  - string: either the name or the path of an object
//  - object: all of the key value pairs in the object match key value pairs in
//    the property
function findObject(searchParams) {
  var objects = this.plistData.objects;
  var objectUuid = this.allUuids().find(function(uuid) {
    if (typeof(searchParams) === 'string') {
      return (
        (_.get(objects[uuid], 'name') === searchParams) ||
        (_.get(objects[uuid], 'path') === searchParams)
      );
    }

    return !Object.keys(searchParams).some(function(key) {
      return !_.has(objects[uuid], key) || objects[uuid][key] !== searchParams[key];
    });
  });

  if (!objectUuid) {
    return;
  }

  return objects[objectUuid];
}

// add a new property to the plist
function addDict(uuid, isa, otherProps) {
  this.plistData.objects[uuid] = Object.assign({}, { isa: isa }, otherProps)
}

// determines whether the fileName belongs to a header, archive, or framework
//  and adds the appropriate file reference to the specified parent
function addFileReferenceToParent(parentName, fileName) {
  var typeObject;
  var isLibraryFile = false;
  var fileNameBroken = fileName.split('.');
  if (fileNameBroken.length === 2 && fileNameBroken[1] === 'h') {
    typeObject = {
      fileEncoding: 4,
      lastKnownFileType: 'sourcecode.c.h'
    };
  } else if (fileNameBroken.length === 2 && fileNameBroken[1] === 'a') {
    isLibraryFile = true;
    typeObject = {
      lastKnownFileType: 'archive.ar'
    };
  } else if (fileNameBroken.length === 2 && fileNameBroken[1] === 'framework') {
    typeObject = {
      lastKnownFileType: 'wrapper.framework'
    };
  } else {
    return;
  }
  return this.addChildToParent(
    parentName,
    'PBXFileReference',
    Object.assign(
      {},
      {
        sourceTree: '"<group>"',
        path: fileName
      },
      typeObject
    ),
    isLibraryFile
  );
}

// adds a new group to a parent
// The parameter isPath designates whether the group represents a directory
function addGroupToParent(parentName, groupName, isPath) {
  var reference = isPath ? 'path' : 'name';
  this.addChildToParent(parentName, 'PBXGroup', {
    [reference]: groupName,
    sourceTree: '"<group>"',
    children: []
  });
}

// adds a new uuid to the parent that matches the supplied searchParams
//  then adds a child object with the same uuid and returns the uuid
//  - isLibrary specifies whether to add a new build phase and search path for the file
function addChildToParent(searchParams, isa, childObject, isLibraryFile) {
  var newUuid = this.generateUuid();
  var parent = this.findObject(searchParams);
  if (_.has(parent, 'children')) {
    parent
      .children
      .push(newUuid);
  } else if (_.has(parent, 'files')) {
    parent
      .files
      .push(newUuid);
  } else {
    return console.log('Illegal target parent ' + searchParams);
  }

  this.addDict(newUuid, isa, childObject);
  if (isLibraryFile) {
    this.addLibraryFile(newUuid, searchParams);
  }
  return newUuid;
}

// Add property to list of build phases
function addBuildPhase(isa, options) {
  var newUuid = this.generateUuid();
  var parent = this.findObject({isa: 'PBXNativeTarget'});
  if (!parent) {
    console.log('Can\'t find a PBXNativeTarget to add buildPhase.');
    return;
  }

  parent
    .buildPhases
    .push(newUuid);

  this.addDict(newUuid, isa, options);
}

// adds a shellScript with custom text
function addShellScript(scriptContents) {
  this.addBuildPhase('PBXShellScriptBuildPhase', {
    buildActionMask: 2147483647,
    files: [],
    inputPaths: [],
    outputPaths: [],
    runOnlyForDeploymentPostprocessing: 0,
    shellPath: '/bin/sh',
    shellScript: '"' + scriptContents + '"'
  })
}

// Adds a new framework file to the custom template and adds the appropriate
//  search path.
//  - embed specifies whether this will be added as an "Embed Framework" as well
function addFrameworkFile(fileName, directoryName, embed) {
  const newUuid = this.addFileReferenceToParent(
    'CustomTemplate',
    fileName
  );
  // if there was an issue, stop
  if (!uuid) {
    return;
  }

  const searchPath = directoryName ?
    '"$(PROJECT_DIR)/' + directoryName + '"' :
    '"$(PROJECT_DIR)"';
  [
    this.findObject({ isa: 'XCBuildConfiguration', name: 'Debug'}),
    this.findObject({ isa: 'XCBuildConfiguration', name: 'Release'})
  ].forEach(function(buildConfiguration) {
    if (!_.has(buildConfiguration, 'buildSettings.FRAMEWORK_SEARCH_PATHS')) {
      buildConfiguration.buildSettings.FRAMEWORK_SEARCH_PATHS = [
        '"$(inherited)"',
        searchPath,
      ];
    } else if (
      buildConfiguration
        .buildSettings
        .FRAMEWORK_SEARCH_PATHS
        .indexOf(searchPath) < 0
    ) {
      buildConfiguration
        .buildSettings
        .FRAMEWORK_SEARCH_PATHS
        .push(searchPath);
    }
  });

  this.addChildToParent(
    { isa: 'PBXFrameworksBuildPhase'},
    'PBXBuildFile',
    { fileRef: newUuid }
  );

  if (embed) {
    if (!this.findObject('"Embed Frameworks"')) {
      this.addBuildPhase('PBXCopyFilesBuildPhase', {
        name: '"Embed Frameworks"',
        buildActionMask: 2147483647,
        dstPath: '""',
        dstSubfolderSpec: 10,
        files: [],
        runOnlyForDeploymentPostprocessing: 0
      });
    }
    this.addChildToParent(
      '"Embed Frameworks"',
      'PBXBuildFile',
      {
        fileRef: newUuid,
        settings: { ATTRIBUTES: ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }
      }
    );
  }
}

// adds the appropriate search path and build phase for the library file
function addLibraryFile(newUuid, directoryName) {
  const searchPath = directoryName ?
    '"$(PROJECT_DIR)/' + directoryName + '"' :
    '"$(PROJECT_DIR)"';
  [
    this.findObject({ isa: 'XCBuildConfiguration', name: 'Debug'}),
    this.findObject({ isa: 'XCBuildConfiguration', name: 'Release'})
  ].forEach(function(buildConfiguration) {
    if (!_.has(buildConfiguration, 'buildSettings.LIBRARY_SEARCH_PATHS')) {
      buildConfiguration.buildSettings.LIBRARY_SEARCH_PATHS = [
        '"$(inherited)"',
        searchPath,
      ];
    } else if (
      buildConfiguration
        .buildSettings
        .LIBRARY_SEARCH_PATHS
        .indexOf(searchPath) < 0
    ) {
      buildConfiguration
        .buildSettings
        .LIBRARY_SEARCH_PATHS
        .push(searchPath);
    }
  });

  this.addChildToParent(
    { isa: 'PBXFrameworksBuildPhase'},
    'PBXBuildFile',
    { fileRef: newUuid }
  );
}

function setProvisioningStyle(style) {
  var projectObject = this.findObject({isa: 'PBXProject'});

  projectObject.attributes.TargetAttributes = projectObject.targets
    .reduce((acc, target) => {
      return Object.assign({}, acc, {[target]: {ProvisioningStyle: style}});
    }, {});
}
