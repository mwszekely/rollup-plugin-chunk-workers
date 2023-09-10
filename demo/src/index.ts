import { wrap } from "comlink";

const { Foo } = wrap<typeof import("./workers/test.worker.js")>(new Worker(new URL("./workers/test.worker.js", import.meta.url), { type: "module" }));
let b = await new Foo();
const four: number = await b.bar();


const c: AudioContext = null!;
c?.audioWorklet.addModule(new URL("./workers/test.worker.js", import.meta.url));

(async () => {
    const a = await Promise.all([]);
    console.log(a);
})()
