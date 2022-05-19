module.exports.timestamp = function() {
    return Math.floor(Date.now() / 1000);
};
module.exports.code404 = function(res) {
    res.writeHead(404);
    res.end("Error 404: Not found");
    return;
}
module.exports.initTempDir = function() {
    const fs = require("fs");
    if (fs.existsSync("tmp") && fs.lstatSync("tmp").isDirectory()) {
        fs.rmSync("tmp", { recursive: true, force: true });
    }
    fs.mkdirSync("tmp");
}
module.exports.hostnameExists = async function(hostname) {
    const dnsPromises = require('dns').promises;
    try {
        await dnsPromises.lookup(hostname);
        return true;
    } catch (e) {
        return false;
    }
}