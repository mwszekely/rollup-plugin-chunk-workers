import { FilterPattern } from "@rollup/pluginutils";
import { InputPluginOption } from "rollup";
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
export default function chunkWorkersPlugin({ exclude, include, transformPath }?: Partial<ChunkWorkersPluginOptions>): InputPluginOption;
export { chunkWorkersPlugin };
