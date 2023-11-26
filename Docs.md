# Developer documentation for Alexandria
| Table of contents |
|-|
| [Api routes](#api-routes) |
| [Database structure](#database-structure) |
| [Storing plugins](#storing-plugins) |
| [How to make a plugin](#how-to-make-a-plugin) |
## Api routes
### /api/add
Adds a file to Alexandria and downloads its first version.
| Query Parameter | Meaning |
|-|-|
| uri | uri of file to be downloaded |
| name | a name for the file (not empty) |
| [adder?](#fileadder) | a plugin's id to use in order to add the file |

Returns `id` of the file if successful, and the error if unsuccessful.
### /api/update
Tries to update the file with a new version.
Fails if new file hash matches previous version.
If the file was downloaded with a plugin it uses the same plugin to update it.
| Query Parameter | Meaning |
|-|-|
| id | id of the file to be updated |

Returns `hash` of new version if successful or `"false"` if unsuccessful.
### /api/get
Gets a version of a file from the database. Accepts the `Range` headers.
| Query Parameter | Meaning |
|-|-|
| id | id of the file |
| v? | version to return (if ommited assumes newest) |

Returns the file version in question.
### /api/meta
Returns information about a file
| Query Parameter | Meaning |
|-|-|
| id | id of the file |

Returns the file object right as it is in the database.
### /api/list
Returns an array of the values of the [database index](#database-index).
### /api/search
Like `/api/list`, but returns only the files matching some criteria.
If the `by` parameter is not `"id"`, the search string needs to be contained
in the corresponding field in order for the file to match the search.
| Query Parameter | Meaning |
|-|-|
| by | "id", "name" or "uri" |,
| search | searh string |
### /api/del
Deletes a file from Alexandria.
| Query Parameter | Meaning |
|-|-|
| id | id of the file |

Returns `"true"` on success.
### /api/rename
Renames a file.
| Query Parameter | Meaning |
|-|-|
| id | id of the file |
| name | the new name of the file (not empty) |

Returns `"true"` on success.
### /api/plugins
Lists all active plugins on the server that have a certain tag. If `tag` is ommited, returns a list of all plugins.
| Query Parameter | Meaning |
|-|-|
| tag? | tag for search |

Returns their [manifests](#manifest) as in the plugin registry, but with the `symbols` field removed to protect server privacy.
### /api/pluginSymbol
Returns a [web symbol](#terminology) from a certain plugin. It is serialised to be `eval`-ed later.
| Query Parameter | Meaning |
|-|-|
| plugin | the plugin in which the symbol is |
| symbol | the symbol that you want to get |

Returns javascript that when `eval`-ed evaluates to the symbol.
### /api/getFileViewer
Returns the id of the first plugin with the [fileViewer](#fileviewer) tag whose `fileViewerPred` function has accepted the file.
If a file's [`pluginData`](#file-entries) doesn't contain a `viewWith` field, the client will access this api route to see if a plugin wants to dislplay the file. If none is found, it will be displayed the default way.
| Query Parameter | Meaning |
|-|-|
| id | id of the file |

Returns the `id` of the plugin or `"null"` if no suitable plugin is found.

## Database structure
### Database index
The db index is contained in the `index.json` file in the `db` in which the keys are the IDs of the files and the values are the information about them.
#### File entries
A file entry is a value in the db index. It is a json object with the following fields:
| Field | Meaning |
|-|-|
| uri | The uri where the file was downloaded from. |
| name | The name of the file |
| versionTimes | A JSON array of the unix timestamps of each version |
| version | The current version of the file |
| id | The file's id |
| hash | The sha256 hash of the newest version of the file |
| type | The MIME type of the most recent version of the file |
| pluginData | An object where plugins store their data. It will be blank if you have no plugins installed. |

An example entry of a random imgur front page image:
```json
"5cd12aba-0c8f-425b-9c95-374f92917f55": {
	"uri": "https://i.imgur.com/513L1GQ.jpeg",
	"name": "AAA",
	"versionTimes": [
		1701022835
	],
	"version": 0,
	"id": "5cd12aba-0c8f-425b-9c95-374f92917f55",
	"hash": "QmqE9oxmDur7KmWQtyBz+2ieMqodq12nOih/VA0NHoE=",
	"pluginData": {},
	"type": "image/jpeg"
},
```
### File versions
In the `db` folder, in addition to the `index.json` file, for every file there is a folder whose name is the file's `id`.
In this folder are contained the versions of the file. They are in extensionless files in the form `v#`, where `#` is the number of the version.  
![An image of the 3 file version files of an example file.](https://i.imgur.com/tZvYdQw.png)

## Storing plugins
A list of all active plugins is found in the json file `plugins.json` in the main Alexandria directory. It is a JSON object where the keys are the IDs of the plugins and the values are the paths to their main files, relative to the `plugins` folder.
### Installing a plugin
The plugin download should be a zip archive with files and a line to add to `plugins.json`.
The plugin files should be extracted directly into the `plugins` folder and the line added.

## How to make a plugin
To create a plugin, you should create a javascript file (with CommonJS), which for example purposes we will suppose is called `example.js`  
Alongside your plugin you should tell your users to add this line to their `plugins.json` file:
```json
	"example": "example.js"
```
### Terminology
An export of your plugin is called a `symbol`. Symbols which are accessable for the client via the http api are called `web symbols`.

### Manifest
Your main file should contain an exported function `manifest`, which returns an object with the following fields:
| Field | Meaning |
|-|-|
| id | the id of the plugin (can't be `"null"` or `"default"`) |
| name | a human-readable name of the plugin |
| description | a description of the plugin |
| version | the plugin's version |
| tags | an array of the plugin's tags |
| symbols | an object where the keys are the symbol names and the values are the absolute paths to the javascipt files which export them |
| webSymbols? | an array with the names of the symbols that are accessable via the http api. It requires the tag `webSymbols` to be present. |

`example.js` example manifest:
```js
module.exports.manifest = ()=>({
	id: "example",
	name: "Example plugin",
	description: "An example plugin for illustration purposes",
	version: "0.0.0",
	tags: ["fileAdder", "fileViewer", "webSymbols", "exampleTag"],
	symbols: {
		"request": __filename,
		"viewFile": __filename,
		"fileViewerPred": __filename
	},
	webSymbols: [
		"viewFile"
	]
});
```

### Predefined types of plugin
These are tags that when added to a plugin have special functionality, but also have special requirements
#### fileAdder
This means that the plugin has the ability to change how a file is added and downloaded. This can be used for example to create an option for the user to download images off of a twitter post.

| Type of requirement | Required items |
|-|-|
| Tags | `fileAdder` |
| Symbols | function [request](#the-request-function)(uri, tmpFileId, pluginData) |

##### The request function
This function takes a `uri`, the name of the temporary file `tmpFileId` and a reference to the `pluginData` object of the file. It can be async.

Its job is to download the data at the `uri` as it sees fit into `./tmp/${tmpFileId}`. The function should set the `addedWith` field on the `pluginData` object to the id of the plugin. Optionally, if it has the `fileViewer` tag, it can set the `viewWith` field to its id to ensure that the file is always shown with this plugin.

This function should return an object with fields `type` - MIME type of the file and `hash` - sha256 hash of the file.

To help you in writing this function you can include the default download function from Alexandria's `lib_util.js` file.
```js
const { request } = require("../src/lib_util.js");
```
It just downloads the file without tampering with it or changing the `pluginData`

#### fileViewer
This means the plugin has the functionality to change how a file's page is displayed in the browser.
| Type of requirement | Required items |
|-|-|
| Tags | `fileViewer`, `webSymbols` |
| Symbols | function [viewFile](#the-viewfile-function)(file) |
| | function [fileViewerPred](#the-fileviewerpred-function)(file) |
| Web Symbols | [viewFile](#the-viewfile-function) |

The browser will show a file with the plugin if:
1. The file's `pluginData` has a `viewWith` field set to the plugin's `id`.
2. The file's `pluginData` doesn't have a `viewWith` field and this is the first plugin whose [fileViewerPred](#the-fileviewerpred-function) function has accepted it.

##### The viewFile function
This is a function that will be executen client-side. It takes a `file` entry and displays things on the file's page.

##### The fileViewerPred function
This function takes in a `file` db index entry and determines if the plugin wants to display the file. See [/api/getFileViewer](#apigetfileviewer). It returns a bool.