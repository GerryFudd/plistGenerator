## Plist Generator
This is a Node module for reading, modifying, and writing property list files.  It was build with the specific purpose of adding libraries and frameworks to the .pbxproj file in an Xcode project.  It therefore can parse and write property lists that are written in Xcode's Open Step format.

### Installation
```
npm install --save plist-generator
```

### API
The export from this module is a generator function that makes a plist javascript object from a source file.

```
var PlistObject = require('plist-generator');
var plistObject = new PlistObject(fs.readFileSync(<location of .pbxproj file>, 'utf8'));
```

#### Plist Object methods
These are several methods that are designed for adding files or shell scripts to a plist object. These should be sufficient for adding a group with header or archive files to your project or adding an embedded framework.
- `addFileReferenceToParent(parentName, fileName)`:
  - Adds a file reference to a file sitting at `fileName` with an appropriate "lastKnownFileType".
  - Adds the file reference to the list of children or files of an entry with the a name or path parameter that matches `parentName`.
  - If the "lastKnownFileType" is `archive.ar`, then this file is added to the `LIBRARY_SEARCH_PATHS` and the `PBXFrameworksBuildPhase`.
- `addGroupToParent(parentName, groupName, isPath)`:
  - Creates a new group with name `groupName`.
  - Adds it to the list of children of an entry with the a name or path parameter that matches `parentName`.
- `addShellScript(scriptContents)`:
  - Adds a new `PBXShellScriptBuildPhase` to the build phases list whose contents are `scriptContents`.
- `addFrameworkFile(fileName, directoryName, embed)`:
  - Adds a file reference to `fileName` as a child of the `CustomTemplate`.
  - Adds `directoryName` to the `FRAMEWORK_SEARCH_PATHS` for "Debug" and "Release".
  - If `embed` is truthy, add this file reference to the "Embed Frameworks" build phase.

#### Lower level methods
These methods are not designed to be used directly, but are used by the methods above. They are exposed for you to use directly if you want to use any of them.
- `allUuids()`: Returns the list of every uuid that is used in this plist
- `generateUuid()`: Returns a valid uuid that isn't already in use
- `findObject(searchParams)`: returns the first object to match the `searchParams`.  If `searchParams` is a string, then this will only find an object whose "name" or "path" value matches the string exactly.  If `searchParams` is an object, then this will only find object that matches each of the key-value pairs in the `searchParams` object.  If no matches are found, this returns undefined.
- `addDict(uuid, isa, otherProps)`: Adds a new dict with the given `uuid`. Every dict has the given `isa` property and whatever props are in the `otherProps` object.
- `addChildToParent(searchParams, isa, childObject, isLibraryFile)`: This method is called by both `addFileReferenceToParent` and `addGroupToParent`.
  - Uses `findObject(searchParams)` to find the appropriate parent and adds a `newUuid` to this parent's children.
  - Calls `addDict(newUuid, isa, childObject)` to make the child.
  - If `isLibraryFile` is truthy, then calls `addLibraryFile(newUuid, searchParams)`.
- `addBuildPhase(isa, options)`: This method is used by `addShellScript` and `addFrameworkFile`.  It simply calls adds a `newUuid` to the list of "buildPhases" in the `PBXNativeTarget` and then calls `addDict(newUuid, isa, options)`.
- `addLibraryFile(newUuid, directoryName)`:
  - Adds `directoryName` to the `LIBRARY_SEARCH_PATHS` in both "Debug" and "Release".
  - Adds a `fileRef` to `newUuid` as a child of the `PBXFrameworksBuildPhase`.

### Example

```
// Create PlistObject to track changes to the project.pbxproj file
var fs = require('fs');
var PlistObject = require('plist-generator');
var plistObject = new PlistObject(fs.readFileSync(<file path to .pbxproj file>, 'utf8'));

// Add TwilioVoiceClient.framework, which is sitting in the root of the iOS
//  project, to Frameworks and Embed Frameworks
plistObject.addFrameworkFile('TwilioVoiceClient.framework', '', true);
// Add a run script to modify the binary TwilioVoiceClient when making builds
//  so that they only contain the appropriate binaries.
var runScriptContents = 'APP_PATH=\\"${TARGET_BUILD_DIR}/${WRAPPER_NAME}\\"\\n\\n' +
  '# This script loops through the frameworks embedded in the application and\\n' +
  '# removes unused architectures.\\nfind \\"$APP_PATH\\" -name \'*.framework\'' +
  ' -type d | while read -r FRAMEWORK\\ndo\\n' +
  'FRAMEWORK_EXECUTABLE_NAME=$(defaults read \\"$FRAMEWORK/Info.plist\\" ' +
  'CFBundleExecutable)\\nFRAMEWORK_EXECUTABLE_PATH=\\"$FRAMEWORK/' +
  '$FRAMEWORK_EXECUTABLE_NAME\\"\\necho \\"Executable is ' +
  '$FRAMEWORK_EXECUTABLE_PATH\\"\\n\\nEXTRACTED_ARCHS=()\\n\\nfor ARCH in ' +
  '$ARCHS\\ndo\\necho \\"Extracting $ARCH from $FRAMEWORK_EXECUTABLE_NAME\\"\\n' +
  'lipo -extract \\"$ARCH\\" \\"$FRAMEWORK_EXECUTABLE_PATH\\" -o ' +
  '\\"$FRAMEWORK_EXECUTABLE_PATH-$ARCH\\"\\n' +
  'EXTRACTED_ARCHS+=(\\"$FRAMEWORK_EXECUTABLE_PATH-$ARCH\\")\\ndone\\n\\n' +
  'echo \\"Merging extracted architectures: ${ARCHS}\\"\\nlipo -o ' +
  '\\"$FRAMEWORK_EXECUTABLE_PATH-merged\\" -create \\"${EXTRACTED_ARCHS[@]}\\"\\n' +
  'rm \\"${EXTRACTED_ARCHS[@]}\\"\\n\\necho \\"Replacing original executable with ' +
  'thinned version\\"\\nrm \\"$FRAMEWORK_EXECUTABLE_PATH\\"\\n' +
  'mv \\"$FRAMEWORK_EXECUTABLE_PATH-merged\\" \\"$FRAMEWORK_EXECUTABLE_PATH\\"\\n\\n' +
  'done';
plistObject.addShellScript(runScriptContents);

fs.writeFileSync(<file path to .pbxproj file>, plistObject.build());
```
