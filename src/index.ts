import { FilterPattern, createFilter, normalizePath } from "@rollup/pluginutils";
import { Node } from "acorn";
import { simple } from "acorn-walk";
import { CallExpression, Identifier, Literal, MemberExpression, NewExpression } from "estree";
import MagicString from "magic-string";
import { relative } from "path";
import { InputPluginOption } from "rollup";

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

                    simple(moduleInfo.ast!, {
                        "CallExpression": (node) => {
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
                                            const urlArg = exp.arguments[0];
                                            if (urlArg.type == "Literal") {
                                                const url = `${(urlArg as Literal).value}`;
                                                const urlStart = (exp.arguments[0] as never as Node).start;   // What are these types???
                                                const urlEnd = (exp.arguments[0] as never as Node).end;
                                                filesToEmit.push({ url, urlStart, urlEnd })
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "NewExpression": (node) => {
                            const exp = (node as never as NewExpression);
                            let type: "Worker" | "SharedWorker" | undefined = undefined;
                            let url: string | undefined;
                            let urlStart: number | undefined;
                            let urlEnd: number | undefined;
                            switch (exp.callee.type) {
                                case "Identifier":
                                    if (exp.arguments.length >= 1 && exp.arguments[0].type == "Literal") {
                                        url = `${exp.arguments[0].value}`;
                                        urlStart = (exp.arguments[0] as never as Node).start;   // What are these types???
                                        urlEnd = (exp.arguments[0] as never as Node).end;
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
                    })
                    filesToEmit.forEach(({ url, urlStart, urlEnd }) => {
                        const fileId = this.emitFile({
                            type: "chunk",
                            id: url!,
                            fileName: relative(projectDir, url!),
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

