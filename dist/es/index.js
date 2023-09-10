import { createFilter, normalizePath } from '@rollup/pluginutils';
import { simple } from 'acorn-walk';
import MagicString from 'magic-string';
import { relative } from 'path';

const PLUGIN_NAME = "rollup-plugin-chunk-workers";
function parseAddModuleOrNewWorker(ast, callbackOnArgs) {
    simple(ast, {
        "CallExpression": (node) => {
            // This is a function call.
            // but is it a call like "audioWorklet.addModule"?
            const exp = node;
            switch (exp.callee.type) {
                case "MemberExpression": {
                    const mexp = exp.callee;
                    if (mexp.property.type == "Identifier" && mexp.object.type == "MemberExpression" && mexp.object.property.type == "Identifier") {
                        if (mexp.property.name == "addModule" && ["audioWorklet", "paintWorklet"].includes(mexp.object.property.name)
                            ||
                                mexp.property.name == "register" && ["serviceWorker"].includes(mexp.object.property.name)) {
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
            const exp = node;
            let type = undefined;
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
    });
}
function chunkWorkersPlugin({ exclude, include } = {}) {
    let projectDir = process.cwd();
    const filter = createFilter(include, exclude);
    return {
        name: PLUGIN_NAME,
        async transform(code, id) {
            if (filter(id)) {
                try {
                    let magicString = new MagicString(code);
                    const moduleInfo = this.getModuleInfo(id);
                    moduleInfo.ast = this.parse(code);
                    let filesToEmit = new Array();
                    parseAddModuleOrNewWorker(moduleInfo.ast, (args) => {
                        const urlArg = args[0];
                        if (urlArg.type == "NewExpression" && urlArg.callee.type == "Identifier" && urlArg.callee.name == 'URL') {
                            let newExp = urlArg;
                            if (newExp.arguments.length == 2 &&
                                newExp.arguments[0].type == "Literal" &&
                                newExp.arguments[1].type == "MemberExpression") {
                                let relDir = newExp.arguments[0];
                                let meta = newExp.arguments[1];
                                if (meta.object.type == "MetaProperty" && meta.property.type == "Identifier" && meta.property.name == "url") {
                                    filesToEmit.push({
                                        url: `${relDir.value}`,
                                        urlStart: newExp.start,
                                        urlEnd: newExp.end,
                                    });
                                }
                            }
                        }
                    });
                    filesToEmit.forEach(({ url, urlStart, urlEnd }) => {
                        const fileId = this.emitFile({
                            type: "chunk",
                            id: url,
                            fileName: normalizePath(relative(projectDir, url)),
                            importer: id
                        });
                        const fileName = this.getFileName(fileId);
                        if (urlStart && urlEnd)
                            magicString.update(urlStart, urlEnd, JSON.stringify(normalizePath(fileName)));
                    });
                    return {
                        code: magicString.toString(),
                        map: magicString.generateMap({ hires: true })
                    };
                }
                catch (ex) {
                    // Assume this wasn't a module meant for us
                }
            }
        },
    };
}

export { chunkWorkersPlugin, chunkWorkersPlugin as default };
//# sourceMappingURL=index.js.map
