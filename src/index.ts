import { FilterPattern, createFilter, normalizePath } from "@rollup/pluginutils";
import { Node } from "acorn";
import { simple } from "acorn-walk";
import { CallExpression, Expression, Identifier, Literal, MemberExpression, NewExpression, SpreadElement } from "estree";
import MagicString from "magic-string";
import { relative } from "path";
import { AcornNode, InputPluginOption } from "rollup";

export interface DataPluginOptions {

    /**
     * Files prefixed with `datafile:` will always be included, but this can be used to load files even if they don't.
     */
    include?: FilterPattern;

    /**
     * Excludes any files that were included by `include` (has no effect on `datafile:` ids)
     */
    exclude?: FilterPattern;
}

const PLUGIN_NAME = "rollup-plugin-chunk-workers";

function parseAddModuleOrNewWorker(ast: AcornNode, callbackOnArgs: (args: (Expression | SpreadElement)[]) => void) {
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
                            /*const urlArg = exp.arguments[0];
                            if (urlArg.type == "Literal") {
                                const url = `${(urlArg as Literal).value}`;
                                const urlStart = (exp.arguments[0] as never as Node).start;   // What are these types???
                                const urlEnd = (exp.arguments[0] as never as Node).end;
                                filesToEmit.push({ url, urlStart, urlEnd })
                            }*/
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
                        //url = `${exp.arguments[0].value}`;
                        //urlStart = (exp.arguments[0] as never as Node).start;   // What are these types???
                        //urlEnd = (exp.arguments[0] as never as Node).end;
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
                            // Definitely a "new Worker" expression
                            //filesToEmit.push({ url, urlStart, urlEnd });
                        }
                    }
                    break;
            }
        }
    })
}

export default function chunkWorkersPlugin({ exclude, include }: Partial<DataPluginOptions> = {}): InputPluginOption {

    let projectDir = process.cwd();
    const filter = createFilter(include, exclude);
    return {
        name: PLUGIN_NAME,
        async transform(code, id) {

            if (filter(id)) {
                try {
                    let magicString = new MagicString(code);
                    const moduleInfo = this.getModuleInfo(id)!;
                    moduleInfo.ast = this.parse(code);

                    let filesToEmit = new Array<{ url: string, urlStart: number, urlEnd: number }>();

                    parseAddModuleOrNewWorker(moduleInfo.ast!, (args) => {
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
                                        filesToEmit.push({
                                            url: `${relDir.value}`,
                                            urlStart: (newExp as never as Node).start,
                                            urlEnd: (newExp as never as Node).end,
                                        })
                                    }
                            }
                        }
                    });
                    
                    filesToEmit.forEach(({ url, urlStart, urlEnd }) => {
                        const fileId = this.emitFile({
                            type: "chunk",
                            id: url!,
                            fileName: normalizePath(relative(projectDir, url!)),
                            importer: id
                        });
                        const fileName = this.getFileName(fileId);
                        if (urlStart && urlEnd)
                            magicString.update(urlStart, urlEnd, JSON.stringify(normalizePath(fileName)));
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

