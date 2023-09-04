import { wrap } from "comlink";

const { Foo } = wrap<typeof import("./workers/test.worker.js")>(new Worker("./workers/test.worker.js"));
let b = await new Foo();
const four: number = await b.bar();


const c: AudioContext = null!;
c?.audioWorklet.addModule("./workers/test.worker.js");

(async () => {
    const a = await Promise.all([]);
    console.log(a);
})()
