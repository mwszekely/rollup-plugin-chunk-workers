import { wrap } from "comlink";

(async () => {

    const w = new Worker(new URL("./workers/test.worker.js", import.meta.url), { type: "module" });
    debugger;
    const wrapped = wrap<typeof import("./workers/test.worker.js")>(w);
    let b = await new wrapped.Foo();
    const four: number = await b.bar();
    console.log(four);


    const c: AudioContext = {} as any;
    ("audioWorklet" in c && c.audioWorklet.addModule(new URL("./workers/test.worker.js", import.meta.url), {}));


    const a = await Promise.all([]);
    console.log(a);
})()
