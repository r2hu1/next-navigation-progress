import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const external = ["react", "next/navigation"];

export default [
	// ES Module build
	{
		input: "src/index.ts",
		output: {
			file: "dist/index.esm.js",
			format: "es",
			sourcemap: true,
		},
		external,
		plugins: [
			resolve(),
			typescript({
				tsconfig: "./tsconfig.json",
				declaration: false,
				declarationMap: false,
			}),
		],
	},
	// CommonJS build
	{
		input: "src/index.ts",
		output: {
			file: "dist/index.js",
			format: "cjs",
			sourcemap: true,
			exports: "named",
		},
		external,
		plugins: [
			resolve(),
			typescript({
				tsconfig: "./tsconfig.json",
				declaration: false,
				declarationMap: false,
			}),
		],
	},
	// Type definitions
	{
		input: "src/index.ts",
		output: {
			file: "dist/index.d.ts",
			format: "es",
		},
		external,
		plugins: [dts()],
	},
];
