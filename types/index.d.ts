import { FilterPattern } from "@rollup/pluginutils";
import { InputPluginOption } from "rollup";
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
export default function chunkWorkersPlugin({ exclude, include, transformPath, mode: mode2 }?: Partial<ChunkWorkersPluginOptions>): InputPluginOption;
export { chunkWorkersPlugin };
