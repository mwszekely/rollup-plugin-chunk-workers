import { wrap } from "comlink";

const wrapped = wrap<typeof import("./workers/test.worker.js")>(new Worker(new URL("./workers/test.worker.js", import.meta.url), { type: "module" }));
debugger;
let b = await new wrapped.Foo();
const four: number = await b.bar();
console.log(four);


const c: AudioContext = {} as any;
("audioWorklet" in c && c.audioWorklet.addModule(new URL("./workers/test.worker.js", import.meta.url), {  }));

(async () => {
    const a = await Promise.all([]);
    console.log(a);
})()
