const http = require("http");
const https = require("https");
const fs = require("fs");
const uuid = require("crypto").randomUUID;
const path = require("path").posix;
const crypto = require("crypto");
const url = require("url");
const qs = require("querystring");
const { timestamp, code404, initTempDir, request } = require("./lib_util.js");
const { initDB, saveDB } = require("./lib_db.js");
const { initPluginSys, getPluginSymbol, filterPluginsTag } = require("./lib_pluginsys.js");
const { serialise } = require("./lib_serialise.js");

const config = JSON.parse(fs.readFileSync("../config.json"));

initDB();
initPluginSys();
initTempDir();
setInterval(saveDB, 10 * 1000);

function getPluginRequestFunction(plugin) {
    if (plugin == null) {
        return request;
    }
    return getPluginSymbol(plugin, "request");
}

const add = ({ uri, name, adder = null, bodyTmpId = null, type = null }) => new Promise((res, rej) => {
    if (name.length == 0) {
        res.writeHead(400);
        res.end("Name can not be empty");
        return;
    }
    let id = uuid();
    while (db[id]) { id = uuid(); }
    let obj = {
        uri,
        name,
        versionTimes: [],
        version: 0,
        id,
        hash: null,
        pluginData: {},
        type: type
    };
    let tmpFilename = uuid();
    let isLocal = (uri == null);
    let source = isLocal ? bodyTmpId : uri;
    getPluginRequestFunction(adder)(source, tmpFilename, obj.pluginData, isLocal)
        .then(results => {
            obj.hash = results.hash;
            if (results.receivedType) {
                obj.type = results.receivedType;
            }
            obj.versionTimes.push(timestamp());
            fs.mkdirSync(`./db/${id}`);
            fs.renameSync(`./tmp/${tmpFilename}`, `./db/${id}/v0`);
            db[id] = obj;
            saveDB();
            res(id);
        })
        .catch(rej);
});
const update = id => new Promise((res, rej) => {
    if (db[id].uri == null) { rej("You can't update a locally added file."); return; }
    let tmpFilename = uuid();
    getPluginRequestFunction(db[id].pluginData.addedWith)(db[id].uri, tmpFilename, db[id].pluginData)
        .then(({ hash, type }) => {
            if (db[id].hash == hash) {
                db[id].versionTimes[db[id].versionTimes.length - 1] = timestamp();
                try {
                    fs.rmSync(`./tmp/${tmpFilename}`);
                } catch (e) { }
                res(false);
                return;
            }
            fs.renameSync(`./tmp/${tmpFilename}`, `./db/${id}/v${db[id].version + 1}`);
            db[id].versionTimes.push(timestamp());
            db[id].version++;
            db[id].hash = hash;
            db[id].type = type;
            saveDB();
            res(hash);
        })
        .catch(rej);
});

function api_get(id, ver, headers, res) {
    let size = fs.statSync(`./db/${id}/v${ver}`).size;
    if (headers["range"]) {
        if (headers["range"].startsWith("bytes=")) {
            let range_txt = headers["range"].slice("bytes=".length);
            let range = range_txt.split("-");
            range[0] = Number(range[0]);
            range[1] = (range[1].length > 0 ? Number(range[1]) : size - 1);
            if (range[0] >= size || range[1] >= size) {
                res.writeHead(416, {
                    "content-type": db[id].type,
                    "content-length": size,
                    "Accept-Ranges": "bytes"
                });
                res.end();
                return;
            }
            res.writeHead(206, {
                "content-type": db[id].type,
                "content-length": range[1] - range[0] + 1, //size,
                "Accept-Ranges": "bytes",
                "Content-Range": `bytes ${range[0]}-${range[1]}/${size}`
            });
            fs.createReadStream(`./db/${id}/v${ver}`, {
                start: range[0],
                end: range[1]
            }).pipe(res);
        }
    } else {
        res.writeHead(200, {
            "content-type": db[id].type,
            "content-length": size,
            "Accept-Ranges": "bytes"
        });
        fs.createReadStream(`./db/${id}/v${ver}`).pipe(res);
    }
}

function api_meta(id, res) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(db[id]));
    return;
}

function api_list(res) {
    let list = [];
    for (el in db) { list.push(el); }
    list.sort((a, b) => db[a].versionTimes[0] - db[b].versionTimes[0]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(list));
}

function api_search(by, search, res) {
    let found = [];
    for (id in db) {
        if (db[id][by].includes(search)) {
            found.push(id);
        }
    }
    found.sort((a, b) => db[a].versionTimes[0] - db[b].versionTimes[0]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(found));
}

function api_del(id, res) {
    try {
        fs.rmSync(`db/${id}`, { recursive: true, force: true });
    } catch (e) { }
    delete db[id];
    saveDB();
    res.end("true");
}

function api_rename(id, name, res) {
    if (name.length == 0) {
        res.writeHead(400);
        res.end("Name can not be empty");
        return;
    }
    db[id].name = name;
    res.end("true");
}

function api_plugins(tag = null, res) {
    let list = filterPluginsTag(tag);
    list.forEach(e => delete e["symbols"]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(list));
}

function api_pluginSymbol(plugin, symbol, res) {
    if ((!plugins[plugin].tags.includes("webSymbols")) || (!plugins[plugin].webSymbols.includes(symbol))) {
        res.writeHead(403);
        res.end("This symbol is server-side only.");
        return;
    }
    let sym = getPluginSymbol(plugin, symbol);
    res.writeHead(200, { "Content-Type": "text/javascript" });
    res.end(serialise(sym));
}

function api_getFileViewer(id, res) {
    const fileViewers = filterPluginsTag("fileViewer");
    for (p of fileViewers) {
        if (getPluginSymbol(p.id, "fileViewerPred")(db[id])) {
            res.end(p.id);
            return;
        }
    }
    res.end("null");
}

function api_getFileAdders(inputData, res) {
    let list = filterPluginsTag("fileAdder");
    list = list.filter(p => getPluginSymbol(p.id, "fileAdderPred")(inputData));
    list.forEach(e => delete e["symbols"]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(list));
}

function api(req, res) {
    let parsed = url.parse(req.url);
    let endpoint = parsed.pathname.slice(5);
    let query = qs.parse(parsed.query);
    if (endpoint == "add") {
        if (!query["uri"]) {
            res.writeHead(400);
            res.end("Must include \"uri\" query parameter");
            return;
        }
        query.uri = decodeURIComponent(query.uri);
        if (query.uri == "null") { query.uri = null; }
        if (query.uri == null && req.method == "GET") {
            res.writeHead(400);
            res.end("You must either make a GET request with a uri, or a POST one with a file upload.");
            return;
        }
        if (query.url != null && req.method == "POST") {
            res.writeHead(400);
            res.end("You must either make a GET request with a uri, or a POST one with a file upload");
            return;
        }

        if (!query.name) {
            res.writeHead(400);
            res.end("Must include \"name\" query parameter");
            return;
        }
        query.name = decodeURIComponent(query.name);
        let addParams = { uri: query.uri, name: query.name, bodyTmpId: req.bodyTmpId, type: query.type };
        if (query.adder && plugins[query.adder].tags.includes("fileAdder")) {
            addParams.adder = query.adder;
        }
        add(addParams)
            .then(r => {
                res.writeHead(200);
                res.end(`${r}`);
            })
            .catch(e => {
                res.writeHead(404);
                res.end(`${e}`);
            });
        return;
    } else if (endpoint == "update") {
        if (!query.id) {
            res.writeHead(400);
            res.end("Must include \"id\" query parameter");
            return;
        }
        if (!db[query.id]) {
            res.writeHead(404);
            res.end("No file with such id");
            return;
        }
        if (db[query.id].uri == null) {
            res.writeHead(404);
            res.end("You can't update a locally added file");
            return;
        }
        update(query.id)
            .then(r => {
                res.writeHead(200);
                res.end(`${r}`);
            })
            .catch(e => {
                res.writeHead(404);
                res.end(`${e}`);
            });
    } else if (endpoint == "get") {
        if (!query.id) {
            res.writeHead(400);
            res.end("Must include \"id\" query parameter");
            return;
        }
        if (!db[query.id]) {
            res.writeHead(404);
            res.end("No file with such id");
            return;
        }
        let v;
        if (query.v) { v = query.v } else { v = db[query.id].version; }
        if (db[query.id].version < v) {
            res.writeHead(404);
            res.end("This file hasn't reached this version yet");
            return;
        }
        api_get(query.id, v, req.headers, res);
        return;
    } else if (endpoint == "meta") {
        if (!query.id) {
            res.writeHead(400);
            res.end("Must include \"id\" query parameter");
            return;
        }
        if (!db[query.id]) {
            res.writeHead(404);
            res.end("No file with such id");
            return;
        }
        api_meta(query.id, res);
    } else if (endpoint == "list") {
        api_list(res);
    } else if (endpoint == "search") {
        if (!query.by) {
            res.writeHead(400);
            res.end("Must include \"by\" query parameter");
            return;
        }
        if (query.by != "id" && query.by != "name" && query.by != "uri") {
            res.writeHead(400);
            res.end(`'by' must be "id", "name" or "uri"`);
            return;
        }
        if (!query.search) {
            res.writeHead(400);
            res.end("Must include \"search\" query parameter");
            return;
        }
        query.search = decodeURIComponent(query.search);
        api_search(query.by, query.search, res);
    } else if (endpoint == "del") {
        if (!query.id) {
            res.writeHead(400);
            res.end("Must include \"id\" query parameter");
            return;
        }
        if (!db[query.id]) {
            res.writeHead(404);
            res.end("No file with such id");
            return;
        }
        api_del(query.id, res);
    } else if (endpoint == "ren") {
        if (!query.id) {
            res.writeHead(400);
            res.end("Must include \"id\" query parameter");
            return;
        }
        if (!db[query.id]) {
            res.writeHead(404);
            res.end("No file with such id");
            return;
        }
        if (!query.name) {
            res.writeHead(400);
            res.end("Must include \"name\" query parameter");
            return;
        }
        query.name = decodeURIComponent(query.name);
        api_rename(query.id, query.name, res);
    } else if (endpoint == "plugins") {
        api_plugins(query.tag || null, res);
    } else if (endpoint == "pluginSymbol") {
        if (!query.plugin) {
            res.writeHead(400);
            res.end("Must include \"plugin\" query parameter");
            return;
        }
        if (!query.symbol) {
            res.writeHead(400);
            res.end("Must include \"symbol\" query parameter");
            return;
        }
        if (!plugins[query.plugin]) {
            res.writeHead(404);
            res.end("No plugin with such id");
            return;
        }
        if (!plugins[query.plugin].symbols[query.symbol]) {
            res.writeHead(404);
            res.end("This plugin doesn't contain such symbol");
        }
        api_pluginSymbol(query.plugin, query.symbol, res);
    } else if (endpoint == "getFileViewer") {
        if (!query.id) {
            res.writeHead(400);
            res.end("Must include \"id\" query parameter");
            return;
        }
        if (!db[query.id]) {
            res.writeHead(404);
            res.end("No file with such id");
            return;
        }
        api_getFileViewer(query.id, res);
    } else if (endpoint == "getFileAdders") {
        if (!query.inputData) {
            res.writeHead(400);
            res.end("Must include \"inputData\" query parameter");
            return;
        }
        let inputData;
        try {
            inputData = JSON.parse(decodeURIComponent(query.inputData));
        } catch (e) {
            res.writeHead(400);
            res.end("Invalid inputData");
            return;
        }
        api_getFileAdders(inputData, res);
    } else {
        code404(res);
    }
}

function getMimeType(filepath) {
    let ext = path.extname(filepath).toLowerCase();
    switch (ext) {
        case ".html": return "text/html";
        case ".js": return "application/javascript";
        case ".css": return "text/css";
        case ".json": return "application/json";
        case ".png": return "image/png";
        case ".jpg":
        case ".jpeg": return "image/jpeg";
        case ".gif": return "image/gif";
        case ".svg": return "image/svg+xml";
        case ".txt":
        default:
            return "text/plain";
    };
};

function public(req, res) {
    let parsed = url.parse(req.url);
    let pathname = parsed.pathname;
    let query = qs.parse(parsed.query);
    if (pathname == "/") { pathname = "/index.html"; }
    let public = path.join(__dirname, "../public").replace(/\\/g, '/');
    let filepath = path.join(public, pathname);
    if (!filepath.startsWith(public)) {
        code404(res);
        return;
    }
    if (!fs.existsSync(filepath)) {
        if (filepath.endsWith("/")) { filepath = filepath.slice(0, -1); }
        filepath += ".html";
        if (!fs.existsSync(filepath)) {
            code404(res);
            return;
        }
    }
    res.writeHead(200, { "Content-Type": getMimeType(filepath) });
    fs.createReadStream(filepath).pipe(res);
}

http.createServer((req, res) => {
    req.bodyTmpId = uuid();
    let fileStream = fs.createWriteStream(`./tmp/${req.bodyTmpId}`);
    req.on("data", d => fileStream.write(d));
    req.on("end", () => {
        fileStream.end();
        fileStream.close();
        if (req.url.startsWith("/api/")) {
            api(req, res);
        } else {
            public(req, res);
        }
    });
    res.on("close", ()=>{
        if(fs.existsSync(`./tmp/${req.bodyTmpId}`)){
            fs.rmSync(`./tmp/${req.bodyTmpId}`);
        }
    });
}).listen(config.port, () => {
    console.log(`listening on port ${config.port}`);
});