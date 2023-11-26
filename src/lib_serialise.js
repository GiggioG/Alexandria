const uuid = require("crypto").randomUUID;

function ser(obj, symbolRegistry) {
    let t = typeof obj;
    let trivialTypes = [
        "undefined",
        "boolean",
        "number",
        "string"
    ];
    if (trivialTypes.includes(t)) { return JSON.stringify(obj); }
    if (t == "object" && obj == null) { return "null"; }
    if (t == "bigint") { return String(obj) + 'n'; }
    if (t == "function") { return String(obj); }
    if (t == "symbol") {
        if(!symbolRegistry[obj]){
            symbolRegistry[obj] = uuid();
        }
        return `Symbol.for(\"${symbolRegistry[obj]}\")`;
    }
    if (t == "object") {
        let keyValuePairs = [];
        for(k in obj){
            keyValuePairs.push(`${ser(k, symbolRegistry)}: ${ser(obj[k], symbolRegistry)}`);
        }
        return '{' + keyValuePairs.join(',') + '}';
    }
}

module.exports.serialise = o=>{
    let symbolRegistry = {};
    return ser(o, symbolRegistry);
};