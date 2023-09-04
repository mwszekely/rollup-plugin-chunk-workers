import { createFilter, normalizePath } from '@rollup/pluginutils';
import { simple } from 'acorn-walk';
import MagicString from 'magic-string';
import { relative } from 'path';

const PLUGIN_NAME = "rollup-plugin-chunk-workers";
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
                    simple(moduleInfo.ast, {
                        "CallExpression": (node) => {
                            const exp = node;
                            switch (exp.callee.type) {
                                case "MemberExpression": {
                                    const mexp = exp.callee;
                                    if (mexp.property.type == "Identifier" && mexp.object.type == "MemberExpression" && mexp.object.property.type == "Identifier") {
                                        if (mexp.property.name == "addModule" && ["audioWorklet", "paintWorklet"].includes(mexp.object.property.name)
                                            ||
                                                mexp.property.name == "register" && ["serviceWorker"].includes(mexp.object.property.name)) {
                                            const urlArg = exp.arguments[0];
                                            if (urlArg.type == "Literal") {
                                                const url = `${urlArg.value}`;
                                                const urlStart = exp.arguments[0].start; // What are these types???
                                                const urlEnd = exp.arguments[0].end;
                                                filesToEmit.push({ url, urlStart, urlEnd });
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "NewExpression": (node) => {
                            const exp = node;
                            let type = undefined;
                            let url;
                            let urlStart;
                            let urlEnd;
                            switch (exp.callee.type) {
                                case "Identifier":
                                    if (exp.arguments.length >= 1 && exp.arguments[0].type == "Literal") {
                                        url = `${exp.arguments[0].value}`;
                                        urlStart = exp.arguments[0].start; // What are these types???
                                        urlEnd = exp.arguments[0].end;
                                        switch (exp.callee.name) {
                                            case "Worker":
                                                type = "Worker";
                                                break;
                                            case "SharedWorker":
                                                type = "SharedWorker";
                                                break;
                                        }
                                        if (type) {
                                            filesToEmit.push({ url, urlStart, urlEnd });
                                        }
                                    }
                                    break;
                            }
                        }
                    });
                    filesToEmit.forEach(({ url, urlStart, urlEnd }) => {
                        const fileId = this.emitFile({
                            type: "chunk",
                            id: url,
                            fileName: relative(projectDir, url),
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
