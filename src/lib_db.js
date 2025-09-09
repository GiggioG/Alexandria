const fs = require("fs");

module.exports.initDB = function () {
    if (!fs.existsSync("./db")) { fs.mkdirSync("./db"); }
    if (!fs.existsSync("./db/index.json")) {
        global.db = {};
    } else {
        global.db = JSON.parse(fs.readFileSync("./db/index.json"));
    }
    fs.readdirSync("./db").forEach(f => {
        if (f == "index.json") { return; }
        if (!db[f]) {
            try {
                fs.rmSync(`./db/${f}`, { recursive: true, force: true });
            } catch (e) { }
        }
    });
}
module.exports.saveDB = function () {
    fs.writeFileSync("./db/index.json", JSON.stringify(db));
}