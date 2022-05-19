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
            let a1 = el("a", null, "filelink");
            a1.href = `/api/get?id=${id}`;
            a1.target = "_blank";
            let filename = el("span", f.name, "filename");
            a1.appendChild(filename);
            li.appendChild(a1);
            let a2 = el("a", " (Info)", "small");
            a2.href = `/file?id=${id}`;
            li.appendChild(a2);
            li.appendChild(el("br"));
            let mimetype = el("span", `(${f.type.split(';')[0]})`, "sub");
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