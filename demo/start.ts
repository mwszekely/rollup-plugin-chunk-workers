
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import * as path from "node:path";
import { RollupOptions, rollup } from "rollup";
import chunkWorkers from "../dist/es/index.js";

const extensions = [".js", ".jsx", ".ts", ".tsx"];
(async () => {
    const opts = {
        input: "./src/index.ts",
        output: {
            sourcemap: true,
            dir: "./dist",
            format: "esm"
        },
        plugins: [
            (typescript as any)(),
            (chunkWorkers as any)({
                transformPath: (p: string) => path.parse(p).base
            }),
            nodeResolve({ extensions })
        ]
    } satisfies RollupOptions;

    let rollupBuild = await rollup(opts);

    await rollupBuild.write(opts.output! as never).then(output => {
        console.log(output.output[0].code);
    })
})();
