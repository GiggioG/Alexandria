const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
module.exports.timestamp = function () {
    return Math.floor(Date.now() / 1000);
};
module.exports.code404 = function (res) {
    res.writeHead(404);
    res.end("Error 404: Not found");
    return;
}
module.exports.initTempDir = function () {
    const fs = require("fs");
    if (fs.existsSync("tmp") && fs.lstatSync("tmp").isDirectory()) {
        try {
            fs.rmSync("tmp", { recursive: true, force: true });
        } catch (e) { }
    }
    fs.mkdirSync("tmp");
}
module.exports.hostnameExists = async function (hostname) {
    const dnsPromises = require('dns').promises;
    try {
        await dnsPromises.lookup(hostname);
        return true;
    } catch (e) {
        return false;
    }
}
module.exports.request = (uri, tmpFileId) => new Promise(async (res, rej) => {
    let parsed_url;
    try {
        parsed_url = new URL(uri);
    } catch (e) { rej(e); return; }
    if (!parsed_url) { rej("Invalid uri"); return; }
    if (!(await this.hostnameExists(parsed_url.hostname))) { rej("No such hostname"); return; }
    let hash = crypto.createHash("sha256");
    let stream = fs.createWriteStream(`./tmp/${tmpFileId}`);
    (parsed_url.protocol.slice(0, -1) == "http" ? http : https).request(uri, resp => {
        let type = resp.headers["content-type"] ? resp.headers["content-type"] : "null";
        resp.on("data", d => {
            hash.update(d);
            stream.write(d);
        });
        resp.on("end", () => {
            res({
                hash: hash.digest("base64"),
                type
            });
        });
    }).end();
});