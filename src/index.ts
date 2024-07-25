import { FilterPattern, createFilter, normalizePath } from "@rollup/pluginutils";
import { Node } from "acorn";
import { simple } from "acorn-walk";
import { CallExpression, Expression, Identifier, Literal, MemberExpression, NewExpression, SpreadElement } from "estree";
import MagicString from "magic-string";
import { isAbsolute, join, parse, relative } from "path";
import { AstNode as AcornNode, InputPluginOption } from "rollup";

export type WorkerChunkMode = "chunk" | "inline";

export interface ChunkWorkersPluginOptions {

    /**
     * Standard Rollup `include` pattern; these files will be searched for `Workers` to compile.
     */
    include?: FilterPattern;

    /**
     * Standard Rollup `exclude` pattern; these files will be not searched for `Workers` to compile.
     */
    exclude?: FilterPattern;

    /**
     * If provided, allows renaming a file to be different from whatever it was imported as.
     * 
     * This is particularly useful for changing the directory something is in once built.
     * 
     * E.G. `p => path.parse(p).base` will place everything in the build's root directory (with `import * as path from "node:path"`).
     */
    transformPath?: (normalizedPath: string) => string;

    /**
     * Provisional, please do not rely on this behavior:
     * 
     * * `"chunk"` (default): Workers are compiled as complete chunks, running all plugins on them as expected, and are referenced as a separate file URL.
     * * `"inline"`: Includes the single file referenced as a string. Dependencies are not included -- it's more-or-less expected that the file is pre-compiled.
     */
    mode?: "chunk" | "inline" | ((id: string) => WorkerChunkMode);
}

const PLUGIN_NAME = "rollup-plugin-chunk-workers";

function findWorkerChunkExpressions(ast: AcornNode, callbackOnArgs: (args: (Expression | SpreadElement)[]) => void) {
    simple(ast!, {
        "CallExpression": (node) => {
            // This is a function call.
            // but is it a call like "audioWorklet.addModule"?
            const exp = node as never as CallExpression;
            switch (exp.callee.type) {
                case "MemberExpression": {
                    const mexp = exp.callee as MemberExpression;
                    if (mexp.property.type == "Identifier" && mexp.object.type == "MemberExpression" && (mexp.object as MemberExpression).property.type == "Identifier") {
                        if (
                            (mexp.property as Identifier).name == "addModule" && ["audioWorklet", "paintWorklet"].includes(((mexp.object as MemberExpression).property as Identifier).name)
                            ||
                            (mexp.property as Identifier).name == "register" && ["serviceWorker"].includes(((mexp.object as MemberExpression).property as Identifier).name)

                        ) {
                            // It's a call to create a worklet/service worker.
                            // But is it in the right format?
                            callbackOnArgs(exp.arguments);
                        }
                    }
                }
            }
        },
        "NewExpression": (node) => {
            // This is a "new" expression.
            // But was it a "new Worker" expression?
            const exp = (node as never as NewExpression);
            let type: "Worker" | "SharedWorker" | undefined = undefined;
            //let url: string | undefined;
            //let urlStart: number | undefined;
            //let urlEnd: number | undefined;
            switch (exp.callee.type) {
                case "Identifier":
                    if (exp.arguments.length >= 1) {
                        // Looking more like a "new Worker" expression...
                        // Is it in the right format?
                        switch (exp.callee.name) {
                            case "Worker":
                                type = "Worker";
                                break;
                            case "SharedWorker":
                                type = "SharedWorker";
                                break;
                        }
                        if (type) {
                            callbackOnArgs(exp.arguments);
                        }
                    }
                    break;
            }
        }
    })
}

const MAGIC_PREFIX = `\0INLINE_WORKERS`;

export default function chunkWorkersPlugin({ exclude, include, transformPath, mode: mode2 }: Partial<ChunkWorkersPluginOptions> = {}): InputPluginOption {

    // Default settings
    mode2 ??= "chunk";
    transformPath ??= _ => _;

    // Only used for inline mode, so maybe we won't need these eventually.
    let inlineSynthFileCount: number;
    let inlineSynthFileMappings: Map<string, string>;

    let projectDir = process.cwd();
    const filter = createFilter(include, exclude);

    return {
        name: PLUGIN_NAME,
        buildStart() {
            // These could maybe be in `options()` instead? Dunno.
            // `buildStart` happens right after `options`, 
            // which happens during every new compilation (including in watch mode)
            inlineSynthFileCount = 0;
            inlineSynthFileMappings = new Map();
        },
        async resolveId(id) {
            // Only used in inline mode
            if (id.startsWith(MAGIC_PREFIX)) {
                return id;
            }
        },
        async load(id) {
            if (id.startsWith(MAGIC_PREFIX)) {
                // TODO: Is this better than just `export const __inlined_worker_url = ...`?
                return `const __inlined_worker_url = ${inlineSynthFileMappings.get(id.substring(MAGIC_PREFIX.length))};\nexport default __inlined_worker_url;`
            }
        },
        async transform(code, id) {

            const mode = (mode2 instanceof Function) ? mode2(id) : mode2;

            if (filter(id)) {
                try {
                    let magicString = new MagicString(code);

                    // Step 0: Get the AST so we can look for worker instantiations.
                    // 
                    // TODO: We need the AST...is this the best way to get it during the transform phase?
                    // This feels rude.
                    // (Also we modify the code *after* generating the AST)
                    const moduleInfo = this.getModuleInfo(id)!;
                    moduleInfo.ast ||= this.parse(code);

                    // Step 1: Find all the Worker instantiations in this chunk.
                    const filesToEmit: { url: string, replaceStart: number, replaceEnd: number }[] = [];
                    findWorkerChunkExpressions(moduleInfo.ast, (args) => {
                        // We've found one, potentially. 
                        // Make sure it's in the right format.
                        // In particular, by being in the right format we're able to use the URL
                        // as the ID of a new chunk for Rollup to start compiling.
                        const urlArg = args[0];
                        if (urlArg.type == "NewExpression" && urlArg.callee.type == "Identifier" && (urlArg.callee as Identifier).name == 'URL') {
                            let newExp = (urlArg as NewExpression);
                            if (
                                newExp.arguments.length == 2 &&
                                newExp.arguments[0].type == "Literal" &&
                                newExp.arguments[1].type == "MemberExpression") {
                                let relDir = newExp.arguments[0] as Literal;
                                let meta = newExp.arguments[1] as MemberExpression;
                                if (meta.object.type == "MetaProperty" && meta.property.type == "Identifier" && meta.property.name == "url") {

                                    // Right format -- add it to the list of files to emit.
                                    const url = `${relDir.value}`;
                                    const replaceStart = (newExp as never as Node).start;
                                    const replaceEnd = (newExp as never as Node).end;

                                    filesToEmit.push({ url, replaceStart, replaceEnd });
                                }
                            }
                        }
                    });

                    // Step 2: Render all the files that are referenced by `Worker` instantiations.
                    await Promise.all(filesToEmit.map(async ({ replaceEnd: urlEnd, replaceStart: urlStart, url }) => {
                        const fileName2 = transformPath(normalizePath(relative(projectDir, url!)));
                        if (mode == "chunk") {

                            // Duplicates calls to emitFile are fine, the documentation says so
                            const fileId = this.emitFile({
                                type: "chunk",
                                id: url!,
                                fileName: fileName2,
                                importer: id
                            });
                            const fileName = this.getFileName(fileId);
                            if (urlStart && urlEnd) {
                                magicString.update(urlStart, urlEnd, `new URL(${JSON.stringify(fileName)}, import.meta.url)`);
                            }

                        }
                        else {
                            const parsedIdPath = parse(id);
                            const importerPath = parsedIdPath.dir;
                            const fullPath = normalizePath(isAbsolute(url) ? url : join(importerPath, url));
                            const module = await this.load({ id: fullPath /*, resolveDependencies: true*/ }); // resolveDependencies just waits until dependency info is available -- it has no effect on module.code...
                            if (urlStart && urlEnd && module.code) {
                                // `URL.createObjectURL(new Blob([${JSON.stringify(module.code)}], { type: "application/javascript" }))`
                                //const temp = temp2.size;
                                const vid = `${MAGIC_PREFIX}${fullPath}`;
                                inlineSynthFileMappings.set(fullPath, `URL.createObjectURL(new Blob([${JSON.stringify(module.code)}], { type: "application/javascript" }))`);
                                magicString.prepend(`import __inlined_worker_url_${inlineSynthFileCount} from ${JSON.stringify(vid)};\n`);
                                magicString.update(urlStart, urlEnd, `__inlined_worker_url_${inlineSynthFileCount}`);
                                ++inlineSynthFileCount;
                            }
                        }
                    }))

                    return {
                        code: magicString.toString(),
                        map: magicString.generateMap({ hires: true })
                    }
                }
                catch (ex) {
                    // Assume this wasn't a module meant for us
                    //
                    // TODO: I mean, ***I GUESS*** this is fine, but
                    // there's gotta be a better way. This sucks.
                }
            }
        },
    }
}

export { chunkWorkersPlugin };

