import { w as wrap } from './comlink-8vsNNwKO.js';

const wrapped = wrap(new Worker(new URL("test.worker.js", import.meta.url), { type: "module" }));
debugger;
let b = await new wrapped.Foo();
const four = await b.bar();
console.log(four);
const c = {};
("audioWorklet" in c && c.audioWorklet.addModule(new URL("test.worker.js", import.meta.url), {}));
(async () => {
    const a = await Promise.all([]);
    console.log(a);
})();
//# sourceMappingURL=index.js.map
