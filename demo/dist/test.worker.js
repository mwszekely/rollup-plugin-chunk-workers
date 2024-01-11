import { e as expose } from './comlink-8vsNNwKO.js';

function expose2(t) { expose(t); return t; }
var test_worker = expose2({
    Foo: class Foo {
        bar() {
            return 4;
        }
    }
});

export { test_worker as default };
//# sourceMappingURL=test.worker.js.map
