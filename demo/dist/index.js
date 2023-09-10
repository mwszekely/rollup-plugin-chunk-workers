import { w as wrap } from './comlink-6afeecc7.js';

const { Foo } = wrap(new Worker("workers/test.worker.js", { type: "module" }));
let b = await new Foo();
await b.bar();
(async () => {
    const a = await Promise.all([]);
    console.log(a);
})();
//# sourceMappingURL=index.js.map
