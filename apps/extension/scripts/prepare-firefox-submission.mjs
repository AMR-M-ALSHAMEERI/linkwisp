import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const extensionDirectory = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(extensionDirectory, "../..");
const extensionOutput = join(extensionDirectory, ".output");

function runGit(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

const status = runGit(["status", "--porcelain", "--untracked-files=all"]).trim();

if (status) {
  throw new Error(
    "Firefox submission packaging requires a clean Git working tree so the source archive exactly matches the built commit."
  );
}

const [rootPackage, extensionPackage, workerPackage] = await Promise.all([
  readJson(join(repositoryRoot, "package.json")),
  readJson(join(extensionDirectory, "package.json")),
  readJson(join(repositoryRoot, "apps", "worker", "package.json"))
]);

const version = extensionPackage.version;

if (rootPackage.version !== version || workerPackage.version !== version) {
  throw new Error("Root, extension, and Worker package versions must match.");
}

const manifest = await readJson(join(extensionOutput, "firefox-mv2", "manifest.json"));
const gecko = manifest.browser_specific_settings?.gecko;

if (
  manifest.manifest_version !== 2
  || manifest.version !== version
  || gecko?.id !== "linkwisp@amr-m-alshameeri"
) {
  throw new Error("The generated Firefox manifest does not match LinkWisp's expected version, target, or Gecko ID.");
}

const firefoxZipSuffix = `-${version}-firefox.zip`;
const firefoxArchives = (await readdir(extensionOutput))
  .filter((name) => name.endsWith(firefoxZipSuffix));

if (firefoxArchives.length !== 1) {
  throw new Error(`Expected exactly one WXT Firefox ZIP ending in ${firefoxZipSuffix}.`);
}

const submissionDirectory = join(repositoryRoot, "outputs", "firefox-submission", `v${version}`);
const extensionArchive = join(submissionDirectory, `linkwisp-${version}-firefox-unsigned.zip`);
const sourceArchive = join(submissionDirectory, `linkwisp-${version}-source.zip`);
const reviewerNotes = join(submissionDirectory, "AMO_REVIEW.md");
const checksums = join(submissionDirectory, "SHA256SUMS.txt");

await mkdir(submissionDirectory, { recursive: true });
await copyFile(join(extensionOutput, firefoxArchives[0]), extensionArchive);
await copyFile(join(repositoryRoot, "AMO_BUILD.md"), reviewerNotes);

execFileSync(
  "git",
  [
    "archive",
    "--format=zip",
    `--prefix=linkwisp-${version}-source/`,
    "--output",
    sourceArchive,
    "HEAD"
  ],
  { cwd: repositoryRoot, stdio: "inherit" }
);

const checksumEntries = await Promise.all(
  [extensionArchive, sourceArchive, reviewerNotes].map(async (path) => ({
    name: path.slice(submissionDirectory.length + 1),
    hash: await sha256(path)
  }))
);

await writeFile(
  checksums,
  `${checksumEntries.map(({ name, hash }) => `${hash}  ${name}`).join("\n")}\n`,
  "utf8"
);

console.log(`Prepared Firefox submission files in ${submissionDirectory}`);
console.log(`Unsigned extension: ${extensionArchive}`);
console.log(`Reviewer source: ${sourceArchive}`);
console.log(`Checksums: ${checksums}`);
