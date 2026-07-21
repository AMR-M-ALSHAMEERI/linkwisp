import { createHash } from "node:crypto";
import { readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const extensionDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(extensionDirectory, "package.json"), "utf8"));
const outputDirectory = join(extensionDirectory, ".output");
const releaseName = `linkwisp-${packageJson.version}-chrome.zip`;
const candidates = (await readdir(outputDirectory))
  .filter((name) => name.endsWith(`-${packageJson.version}-chrome.zip`));
const generatedName = candidates.find((name) => name !== releaseName) || candidates[0];

if (!generatedName) throw new Error(`No version ${packageJson.version} Chrome ZIP was found in ${outputDirectory}.`);

const generatedPath = join(outputDirectory, generatedName);
const archivePath = join(outputDirectory, releaseName);
if (generatedPath !== archivePath) {
  await rm(archivePath, { force: true });
  await rename(generatedPath, archivePath);
}
const digest = createHash("sha256").update(await readFile(archivePath)).digest("hex");
const checksumPath = `${archivePath}.sha256`;
await writeFile(checksumPath, `${digest}  ${basename(archivePath)}\n`, "utf8");

console.log(`Release archive: ${archivePath}`);
console.log(`SHA-256: ${digest}`);
console.log(`Checksum file: ${checksumPath}`);
