import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const extensionDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(extensionDirectory, "package.json"), "utf8"));
const tag = process.argv[2] || process.env.GITHUB_REF_NAME;
const expectedTag = `v${packageJson.version}`;

if (!tag) throw new Error("Provide a release tag, for example v0.2.0.");
if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag} does not match extension version ${packageJson.version}; expected ${expectedTag}.`);
}

console.log(`Release tag ${tag} matches extension version ${packageJson.version}.`);
