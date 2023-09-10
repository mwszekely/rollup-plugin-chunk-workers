# rollup-plugin-chunk-workers

🍣 A Rollup plugin that will take an expression such as `new Worker("./worker.js")` and `[worklet].addModule("./audio-worklet.js")` and bundle that into a separate chunk whose URL is referenced instead, including all of its dependencies as a separate chunk would.

**(Pre-alpha, probably don't use this. I'm just seeing if this is useful for myself.)**

Works with `@rollup/plugin-typescript`. Like with regular Typescript you would write `new Worker("./worker.js")` instead of ~~`new Worker("./worker.ts")`~~, unless you wanted your generated chunk's filename to end with `.ts`.

Supported transformations:

* `new Worker(new URL("StringLiteral", import.meta.url))`
* `[ctx.]audioWorklet.addModule(new URL("StringLiteral", import.meta.url))`
* `[CSS.]paintWorklet.addModule(new URL("StringLiteral", import.meta.url))`
* `[navigator.]serviceWorker.register(new URL("StringLiteral", import.meta.url))`

Replacing is done by analyzing the file's AST. The benefit is that if any of these constructs appear in a comment or a string, they won't be transformed there. It does mean that variations such as `new (() => { return globalThis })().Worker(...)`, or any path to a module that's not a static `"StringLiteral"`, will not be transformed. `Worker`/`SharedWorker`/`URL` must be unprefixed, and `audioWorklet`/`paintWorklet`/`serviceWorker` cannot be renamed.

Use-case of this plugin: 

* You want to automatically compile the script a `Worker` or `Worklet` loads (e.g. loading a `Worklet` written in Typescript)
* You want scripts loaded by a `Worker` or `Worklet` to be in a separate chunk.

## Why not something more fun, like `import { func } from "worker:./w.js"`

Partially because it becomes tricky how to handle multiple `Worker`s constructed from the same URL, but mostly because Typescript could never auto-infer that type -- if you're using a library like e.g. `Comlink`, all functions are made async, and Typescript's declaration files just aren't precise enough to automatically perform that transformation.

Typescript itself is, though, so if you stick to just normal behavior with `wrap<Remote<typeof import("./w.js")>>(new Worker("./w.js"))`, it all works as expected. Feels better to just not fight against the current here, honestly.

## Requirements

At least rollup@3 in order to build this plugin itself.

## Install

Using npm:

It's on Github only for now, but you can add a Github package to your `package.json` if you're feeling adventurous.

