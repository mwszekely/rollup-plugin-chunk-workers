'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginutils = require('@rollup/pluginutils');
var acornWalk = require('acorn-walk');
var MagicString = require('magic-string');
var path = require('path');

const PLUGIN_NAME = "rollup-plugin-chunk-workers";
function findWorkerChunkExpressions(ast, callbackOnArgs) {
    acornWalk.simple(ast, {
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
    });
}
function chunkWorkersPlugin({ exclude, include, transformPath } = {}) {
    transformPath !== null && transformPath !== void 0 ? transformPath : (transformPath = _ => _);
    let projectDir = process.cwd();
    const filter = pluginutils.createFilter(include, exclude);
    return {
        name: PLUGIN_NAME,
        async transform(code, id) {
            if (filter(id)) {
                try {
                    let magicString = new MagicString(code);
                    // TODO: We need the AST...is this the best way to get it during the transform phase?
                    // This feels rude.
                    const moduleInfo = this.getModuleInfo(id);
                    moduleInfo.ast = this.parse(code);
                    const filesToEmit = [];
                    // Try to find potential expressions to replace.
                    findWorkerChunkExpressions(moduleInfo.ast, (args) => {
                        // We've found one, potentially. 
                        // Make sure it's in the right format.
                        // In particular, by being in the right format we're able to use the URL
                        // as the ID of a new chunk for Rollup to start compiling.
                        const urlArg = args[0];
                        if (urlArg.type == "NewExpression" && urlArg.callee.type == "Identifier" && urlArg.callee.name == 'URL') {
                            let newExp = urlArg;
                            if (newExp.arguments.length == 2 &&
                                newExp.arguments[0].type == "Literal" &&
                                newExp.arguments[1].type == "MemberExpression") {
                                let relDir = newExp.arguments[0];
                                let meta = newExp.arguments[1];
                                if (meta.object.type == "MetaProperty" && meta.property.type == "Identifier" && meta.property.name == "url") {
                                    // Right format -- add it to the list of files to emit.
                                    const url = `${relDir.value}`;
                                    const replaceStart = newExp.start;
                                    const replaceEnd = newExp.end;
                                    filesToEmit.push({ url, replaceStart, replaceEnd });
                                }
                            }
                        }
                    });
                    filesToEmit.forEach(({ replaceEnd: urlEnd, replaceStart: urlStart, url }) => {
                        const fileName2 = transformPath(pluginutils.normalizePath(path.relative(projectDir, url)));
                        // Duplicates calls to emitFile are fine, the documentation says so
                        const fileId = this.emitFile({
                            type: "chunk",
                            id: url,
                            fileName: fileName2,
                            importer: id
                        });
                        const fileName = this.getFileName(fileId);
                        if (urlStart && urlEnd)
                            magicString.update(urlStart, urlEnd, `new URL(${JSON.stringify(fileName)}, import.meta.url)`);
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

exports.chunkWorkersPlugin = chunkWorkersPlugin;
exports.default = chunkWorkersPlugin;
module.exports = Object.assign(exports.default, exports);
//# sourceMappingURL=index.js.map
