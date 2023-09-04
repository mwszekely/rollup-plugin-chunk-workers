
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { RollupOptions, rollup } from "rollup";
import dataPlugin from "../dist/es/index.js";

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
            nodeResolve(),
            dataPlugin({})
        ]
    } satisfies RollupOptions;

    let rollupBuild = await rollup(opts);

    await rollupBuild.write(opts.output! as never).then(output => {
        console.log(output.output[0].code);
    })
})();
