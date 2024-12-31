function el(el, content = null, classname = null) {
    let element = document.createElement(el);
    if (content != null) {
        element.innerText = content;
    }
    if (classname != null) {
        element.className = classname;
    }
    return element;
}

function qs(sel, all = false) {
    if (all) {
        return document.querySelectorAll(sel);
    }
    return document.querySelector(sel);
}

function addFile(id, parent) {
    fetch(`${location.origin}/api/meta?id=${id}`)
        .then(d => d.json())
        .then(f => {
            let li = el("li");
            let a1 = el("a");
            a1.href = `/file?id=${id}`;
            let filename = el("span", f.name, "filename");
            a1.appendChild(filename);
            li.appendChild(a1);
            let a2 = el("a", " (Raw)", "filelink small");
            a2.href = `/api/get?id=${id}`;
            a2.target = "_blank";
            li.appendChild(a2);
            li.appendChild(el("br"));
            let mimetype = el("span", f.type!=null?`(${f.type.split(';')[0]})`:"unknown file type", "sub");
            li.appendChild(mimetype);

            parent.appendChild(li);
        })
        .catch(console.err);
}

function randel(list) {
    return list[Math.floor((Math.random() * list.length))];
}

function spin(text) {
    document.body.innerHTML = `<h1>${text}</h1><img style="width: min(90vh, 90vw);" src="/spinner.gif">`;
}

const getPlugins = (tag) => new Promise((resolve, reject) => {
    fetch(`${location.origin}/api/plugins?tag=${tag}`)
        .then(d => d.json())
        .then(j => resolve(j));
});

const getPluginSymbol = (plugin, symbol) => new Promise((resolve, reject)=>{
    fetch(`${location.origin}/api/pluginSymbol?plugin=${plugin}&symbol=${symbol}`)
        .then(d=>d.text())
        .then(t=>resolve(eval(t)))
        .catch(e=>reject(e));
});