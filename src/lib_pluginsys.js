module.exports.initPluginSys = function() {
    const fs = require("fs");
    if (!fs.existsSync("./plugins")) { fs.mkdirSync("./plugins"); }
    if (!fs.existsSync("./plugins.json")) { fs.writeFileSync("./plugins.json", "{}"); }
    let pluginManifests = require("../plugins.json");
    let plugins = {};
    for(p in pluginManifests){
        let req = require("../plugins/" + pluginManifests[p]);
        if(!req.manifest){ continue; }
        plugins[p] = req.manifest();
    }
    global.plugins = plugins;
}
let loadedFiles = {};
function loadFile(filePath){
    loadedFiles[filePath] = require(filePath);
}
module.exports.getPluginSymbol = function(plugin, sym){
    if(!plugins[plugin]){
        return null;
    }
    if(!plugins[plugin].symbols.hasOwnProperty(sym)){
        return null;
    }
    let filePath = plugins[plugin].symbols[sym];
    if(!loadedFiles[filePath]){
        loadFile(filePath);
    }
    return loadedFiles[filePath][sym];
}
module.exports.filterPluginsTag = function(tag=null){
    let sel = Object.keys(plugins);
    if (tag != null) {
        sel = sel.filter(p => plugins[p].tags.includes(tag));
    }
    let ret = [];
    sel.forEach(p => ret.push(Object.assign({}, plugins[p])));
    return ret;
}