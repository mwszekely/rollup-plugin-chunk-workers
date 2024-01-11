# rollup-plugin-chunk-workers

🍣 A Rollup plugin that will take an expression such as `new Worker(...)` and `[worklet].addModule(...)` and bundle that into a separate chunk whose URL is referenced instead, including all of its dependencies as a separate chunk would.

When using Typescript, as usual you'll probably want to use paths like `"./worker.js"` instead of ~~`"./worker.ts"`~~, unless you wanted your generated chunk's filename to end with `.ts` (which is fine, and can be mitigated with the `transformPath` option).

## Method

Transformations are applied by analyzing the source code's AST.

**Supported transformations**:
* `new Worker(new URL("StringLiteral", import.meta.url), ...)`
* `[ctx.]audioWorklet.addModule(new URL("StringLiteral", import.meta.url), ...)`
* `[CSS.]paintWorklet.addModule(new URL("StringLiteral", import.meta.url), ...)`
* `[navigator.]serviceWorker.register(new URL("StringLiteral", import.meta.url), ...)`

**Unsupported transformations**:
* Intentionally, anything within a comment, string, etc. won't transform (e.g. `/* new Worker(...)  */`, `eval("new Worker(...)")`, etc.)
* Intentionally, `new Worker("StringLiteral")`, so that the semantic differences between *relative URLs* and *relative filepaths* don't cause problems.
* The path must be inline, this will not work: `const path = "./worker.js"; new Worker(new URL(path, import.meta.url));`
* `Worker` must not be qualified, this will also fail: `new globalThis.Worker(...)`
* Globals can't be renamed, as in: `const pw = CSS.paintWorklet; pw.addModule(...)`

## Use-case of this plugin: 

* You want to automatically compile the script a `Worker` or `Worklet` loads (e.g. loading a `Worklet` written in Typescript)
* You want scripts loaded by a `Worker` or `Worklet` to be in a separate chunk

## Why not something more fun, like `import { func } from "worker:./w.js"`

Mostly because the Typescript declaration files that can describe what `worker:*` is can't actually describe what individual `worker:w.js` file are, or really anything complicated enough to infer what `func` would be.

Typescript itself can, though, so if you stick to just normal behavior with (e.g. using Comlink) `wrap<Remote<typeof import("./w.js")>>(new Worker("./w.js"))`, it all works as expected. Feels better to just not fight against the current here, honestly.

## Inlining workers as Data URIs?

I'm not sure if this is possible at the moment, as I haven't found a way to get Rollup to replace a chunk with a Data URI under normal circumstances, and chunks are the only kind of file emit that will follow `import`s all the way down.

## Requirements

At least rollup@3 in order to build this plugin itself.

## Install

Using npm:

It's on Github only for now, but you can add a Github package to your `package.json` if you're feeling adventurous.

