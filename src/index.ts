import { FilterPattern, createFilter, normalizePath } from "@rollup/pluginutils";
import { Node } from "acorn";
import { simple } from "acorn-walk";
import { CallExpression, Expression, Identifier, Literal, MemberExpression, NewExpression, SpreadElement } from "estree";
import MagicString from "magic-string";
import { relative } from "path";
import { AstNode as AcornNode, InputPluginOption } from "rollup";

export interface ChunkWorkersPluginOptions {

    /**
     * Standard Rollup `include` pattern; applies to the string in `new URL("./worker.js")`.
     */
    include?: FilterPattern;

    /**
     * Standard Rollup `exclude` pattern; applies to the string in `new URL("./worker.js")`.
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

export default function chunkWorkersPlugin({ exclude, include, transformPath }: Partial<ChunkWorkersPluginOptions> = {}): InputPluginOption {

    transformPath ??= _ => _;

    let projectDir = process.cwd();
    const filter = createFilter(include, exclude);

    return {
        name: PLUGIN_NAME,
        async transform(code, id) {

            if (filter(id)) {
                try {
                    let magicString = new MagicString(code);

                    // TODO: We need the AST...is this the best way to get it during the transform phase?
                    // This feels rude.
                    const moduleInfo = this.getModuleInfo(id)!;
                    moduleInfo.ast = this.parse(code);

                    const filesToEmit: { url: string, replaceStart: number, replaceEnd: number }[] = [];

                    // Try to find potential expressions to replace.
                    findWorkerChunkExpressions(moduleInfo.ast!, (args) => {
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

                    filesToEmit.forEach(({ replaceEnd: urlEnd, replaceStart: urlStart, url }) => {
                        const fileName2 = transformPath!(normalizePath(relative(projectDir, url!)));

                        // Duplicates calls to emitFile are fine, the documentation says so
                        const fileId = this.emitFile({
                            type: "chunk",
                            id: url!,
                            fileName: fileName2,
                            importer: id
                        });
                        const fileName = this.getFileName(fileId);
                        if (urlStart && urlEnd)
                            magicString.update(urlStart, urlEnd, `new URL(${JSON.stringify(fileName)}, import.meta.url)`);

                    })
                    return {
                        code: magicString.toString(),
                        map: magicString.generateMap({ hires: true })
                    }
                }
                catch (ex) {
                    // Assume this wasn't a module meant for us
                }
            }
        },
    }
}

export { chunkWorkersPlugin };

