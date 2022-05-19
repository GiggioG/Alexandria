module.exports.initDB = function() {
    const fs = require("fs");
    if (!fs.existsSync("./db")) { fs.mkdirSync("db"); }
    if (!fs.existsSync("./db/index.json")) { fs.writeFileSync("./db/index.json", "{}"); }
    global.db = require("./db/index.json");
    fs.readdirSync("./db").forEach(f => {
        if (f == "index.json") { return; }
        if (db[f]) { return; }
        fs.rmSync(`db/${f}`, { recursive: true, force: true });
    });
}
module.exports.saveDB = function() {
    const fs = require("fs");
    fs.writeFileSync("./db/index.json", JSON.stringify(db));
}