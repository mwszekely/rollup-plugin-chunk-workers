
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dataPlugin from "../dist/es/index.js";

export default {
    input: "./src/index.ts",
    output: {
        sourcemap: true,
        dir: "./dist",
        format: "esm"
    },
    plugins: [
        typescript(),
        nodeResolve(),
        dataPlugin({})
    ]
}
