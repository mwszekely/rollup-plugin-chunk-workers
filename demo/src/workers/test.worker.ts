import { expose } from "comlink";

function expose2<T>(t: T) { expose(t); return t; }

export const Foo = expose2(
    class Foo {
        bar() {
            return 4;
        }
    }
);

