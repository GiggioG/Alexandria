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

const config = require("../config.json");

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

const add = ({ uri, name, adder = null }) => new Promise((res, rej) => {
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
        type: "null"
    };
    let tmpFilename = uuid();
    getPluginRequestFunction(adder)(uri, tmpFilename, obj.pluginData)
        .then(({ hash, type }) => {
            obj.hash = hash;
            obj.type = type;
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
    let tmpFilename = uuid();
    getPluginRequestFunction(db[id].pluginData.addedWith)(db[id].uri, tmpFilename, db[id].pluginData)
        .then(({ hash, type }) => {
            if (db[id].hash == hash) {
                db[id].versionTimes[db[id].versionTimes.length - 1] = timestamp();
                fs.rmSync(`./tmp/${tmpFilename}`);
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
    res.end(JSON.stringify(db[id]));
    return;
}

function api_list(res) {
    let list = [];
    for (el in db) { list.push(el); }
    res.end(JSON.stringify(list));
}

function api_search(by, search, res) {
    let found = [];
    for (id in db) {
        if (db[id][by].includes(search)) {
            found.push(id);
        }
    }
    res.end(JSON.stringify(found));
}

function api_del(id, res) {
    fs.rmSync(`db/${id}`, { recursive: true, force: true });
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
    for (k in list) {
        delete list[k]["symbols"];
    }
    res.end(JSON.stringify(list));
}

function api_pluginSymbol(plugin, symbol, res) {
    if ((!plugins[plugin].tags.includes("webSymbols")) || (!plugins[plugin].webSymbols.includes(symbol))) {
        res.writeHead(403);
        res.end("This symbol is server-side only.");
        return;
    }
    let sym = getPluginSymbol(plugin, symbol);
    res.end(serialise(sym));
}

function api_getFileViewer(id, res) {
    for (p in plugins) {
        if (getPluginSymbol(p, "fileViewerPred")(db[id])) {
            res.end(p);
            return;
        }
    }
    res.end("null");
}

function api(req, res) {
    let parsed = url.parse(req.url);
    let endpoint = parsed.pathname.slice(5);
    let query = qs.parse(parsed.query);
    if (endpoint == "add") {
        if (!query.uri) {
            res.writeHead(400);
            res.end("Must include \"uri\" query parameter");
            return;
        }
        if (!query.name) {
            res.writeHead(400);
            res.end("Must include \"name\" query parameter");
            return;
        }
        let addParams = { uri: query.uri, name: query.name };
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
    } else {
        code404(res);
    }
}

function public(req, res) {
    let parsed = url.parse(req.url);
    let pathname = parsed.pathname;
    let query = qs.parse(parsed.query);
    if (pathname == "/") {
        fs.createReadStream("public/index.html").pipe(res);
    } else {
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
        fs.createReadStream(filepath).pipe(res);
    }
}

http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
        api(req, res);
        return;
    } else {
        public(req, res);
    }
}).listen(config.port, () => {
    console.log(`listening on port ${config.port}`);
});