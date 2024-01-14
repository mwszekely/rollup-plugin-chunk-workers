import { w as wrap } from './comlink-8vsNNwKO.js';

(async () => {
    const w = new Worker(new URL("test.worker.js", import.meta.url), { type: "module" });
    debugger;
    const wrapped = wrap(w);
    let b = await new wrapped.Foo();
    const four = await b.bar();
    console.log(four);
    const c = {};
    ("audioWorklet" in c && c.audioWorklet.addModule(new URL("test.worker.js", import.meta.url), {}));
    const a = await Promise.all([]);
    console.log(a);
})();
//# sourceMappingURL=index.js.map
