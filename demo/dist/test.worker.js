import { e as expose } from './comlink-8vsNNwKO.js';

function expose2(t) { expose(t); return t; }
const { Foo } = expose2({
    Foo: class Foo {
        bar() {
            return 4;
        }
    }
});

export { Foo };
//# sourceMappingURL=test.worker.js.map
