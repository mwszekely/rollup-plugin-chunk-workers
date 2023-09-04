import { FilterPattern } from "@rollup/pluginutils";
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
export default function chunkWorkersPlugin({ exclude, include }?: Partial<DataPluginOptions>): InputPluginOption;
export { chunkWorkersPlugin };
