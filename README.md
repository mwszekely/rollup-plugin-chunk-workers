# rollup-plugin-chunk-workers

🍣 A Rollup plugin that will take an expression such as `new Worker(...)` or `[worklet].addModule(...)` and bundle that into a separate chunk whose URL is referenced instead, including all of its dependencies as a separate chunk would.

When using Typescript, as usual you'll probably want to use paths like `"./worker.js"` instead of ~~`"./worker.ts"`~~, unless you wanted your generated chunk's filename to end with `.ts` (which is fine, and can be mitigated with the `transformPath` option).

## Method

Transformations are applied by analyzing the source code's AST.

**Supported transformations**:
* `new Worker(new URL("PathToWorker", import.meta.url), ...)`
* `[ctx.]audioWorklet.addModule(new URL("PathToWorklet", import.meta.url), ...)`
* `[CSS.]paintWorklet.addModule(new URL("PathToWorklet", import.meta.url), ...)`
* `[navigator.]serviceWorker.register(new URL("PathToWorker", import.meta.url), ...)`

**Unsupported transformations**:
* Intentionally, anything within a comment, string, etc. won't transform (e.g. `/* new Worker(...)  */`, `eval("new Worker(...)")`, etc.)
* Intentionally, `new Worker("PathToWorker")` won't transform so that the semantic differences between *relative URLs* and *relative filepaths* don't cause problems.
* The path must be inline, this will not work: `const path = "./worker.js"; new Worker(new URL(path, import.meta.url));`
* `Worker` must not be qualified, this will also fail: `new globalThis.Worker(...)`
* Globals can't be renamed, as in: `const pw = CSS.paintWorklet; pw.addModule(...)`

## Use-case of this plugin: 

* You want to automatically compile the script a `Worker` or `Worklet` loads (e.g. loading a `Worklet` written in Typescript)
* You want scripts loaded by a `Worker` or `Worklet` to be in a separate chunk without a separate build step.<br>---OR---<br>
* You want scripts loaded by a `Worker` or `Worklet` to be inlined as a string in the same chunk, even if it requires a separate build step.

## Why not something more fun, like `import { func } from "worker:./w.js"`

Mostly because while Typescript *declaration files* can describe what general `worker:*` files are, they can't actually describe what **individual** `worker:w.js` file are, or really anything complicated enough to auto-infer what `func` could be (once there's that `worker:` prefix in there).

Typescript can describe those individual files *without* the prefix, though, so if you stick to just normal behavior with (e.g. using Comlink) `wrap<Remote<typeof import("./w.js")>>(new Worker("./w.js"))`, it all works as expected. Feels better to just not fight against the current here, honestly.

## Inlining workers into one file?

While not an ideal solution, assuming you have a ***pre-compiled*** worker, the `mode` option can be set to `"inline"` to embed the worker in the same file. **No dependencies are resolved this way** (though plugins are), so it may require a separate build step &mdash; one to build the main and worker scripts, another to inline them together. 

Hopefully this will change in the future.

## How does it work?

1. Scan the AST for patterns like `new Worker`, and grab the filepath it references
2. Call [`this.emitFile`](https://rollupjs.org/plugin-development/#this-emitfile) (with `type: "chunk"`) for each path.
3. Rewrite the `new Worker` call to reference the newly-created module.

However, in `inline` mode, step 2 is different:

2. Emit a "virtual module" for each path that just exports a raw string that comes from [`this.load(path)`](https://rollupjs.org/plugin-development/#this-load). Unfortunately, `this.load` does not resolve dependencies into `module.code` even if `resolveDependencies` is `true`, which is the reason for this mode's biggest restriction.

## Requirements

At least rollup@3 in order to build this plugin itself.

## Install

Using npm:

It's on Github only for now, but you can add a Github package to your `package.json` if you're feeling adventurous.

