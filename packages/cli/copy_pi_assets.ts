#!/usr/bin/env bun

import { $, fileURLToPath } from "bun";
import { dirname, resolve } from "path";

await $`mkdir -p ./dist`;

const targetDistDir = resolve("./dist");
const piNodeModuleRoot = dirname(
	dirname(fileURLToPath(import.meta.resolve("@mariozechner/pi-coding-agent"))),
);
const photonNodeModuleRoot = dirname(
	fileURLToPath(import.meta.resolve("@silvia-odwyer/photon-node")),
);
await $`
  cp package.json ${targetDistDir}/package.json
  echo -e "> See also: [./pi-README.md]\n " | cat - README.md > ${targetDistDir}/README.md
  echo -e "> See also: [./pi-CHANGELOG.md]\n" | cat - CHANGELOG.md > ${targetDistDir}/CHANGELOG.md

  cp ${piNodeModuleRoot}/package.json ${targetDistDir}/pi-package.json
  cp ${piNodeModuleRoot}/README.md ${targetDistDir}/pi-README.md
  cp ${piNodeModuleRoot}/CHANGELOG.md ${targetDistDir}/pi-CHANGELOG.md

  mkdir -p ${targetDistDir}/theme
  cp ${piNodeModuleRoot}/dist/modes/interactive/theme/*.json ${targetDistDir}/theme/

  mkdir -p ${targetDistDir}/export-html/vendor
  cp ${piNodeModuleRoot}/dist/core/export-html/template.html ${targetDistDir}/export-html
  cp ${piNodeModuleRoot}/dist/core/export-html/template.css ${targetDistDir}/export-html/template.css
  cp ${piNodeModuleRoot}/dist/core/export-html/template.js ${targetDistDir}/export-html/template.js
  cp ${piNodeModuleRoot}/dist/core/export-html/vendor/* ${targetDistDir}/export-html/vendor
  cp -r ${piNodeModuleRoot}/docs ${targetDistDir}/
  cp -r ${piNodeModuleRoot}/examples ${targetDistDir}/
  cp ${photonNodeModuleRoot}/photon_rs_bg.wasm ${targetDistDir}/
`;
