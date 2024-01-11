import { expose } from "comlink";

function expose2<T>(t: T) { expose(t); return t; }

const { Foo } = expose2(
    {
        Foo: class Foo {
            bar() {
                return 4;
            }
        }
    }
);

export { Foo };

