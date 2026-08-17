import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "terser";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceHtml = join(root, "src/index.html");
const sourceJs = join(root, "src/game.js");
const outputDir = join(root, "dist");
const outputHtml = join(outputDir, "index.html");
const releaseDir = join(root, "release");
const outputZip = join(releaseDir, "two-trick-unicorn.zip");
const limit = 13 * 1024;

function reportSize() {
  if (!existsSync(outputZip)) throw Error("Run npm run pack first");
  const bytes = statSync(outputZip).size;
  const headroom = limit - bytes;
  console.log(`${bytes} bytes (${headroom} bytes headroom)`);
  if (headroom < 0) throw Error(`ZIP exceeds the ${limit}-byte limit`);
  return bytes;
}

async function build() {
  const html = readFileSync(sourceHtml, "utf8")
    .replace(/<!--[^]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .trim();
  const source = readFileSync(sourceJs, "utf8");
  const result = await minify(source, {
    compress: { passes: 2 },
    mangle: { toplevel: true },
    format: { comments: false },
  });
  if (!result.code) throw Error("Terser produced no JavaScript");
  const bundled = html.replace(
    '<script src="game.js"></script>',
    `<script>${result.code}</script>`,
  );
  if (bundled === html) throw Error("Development script tag was not found");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputHtml, bundled);
  console.log(`Built dist/index.html (${Buffer.byteLength(bundled)} bytes)`);
}

function validate() {
  const files = execFileSync("unzip", ["-Z1", outputZip], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  if (files.length !== 1 || files[0] !== "index.html") {
    throw Error(`Unexpected archive contents: ${files.join(", ")}`);
  }
  const html = execFileSync("unzip", ["-p", outputZip, "index.html"], {
    encoding: "utf8",
  });
  if (!/<canvas[ >]/.test(html) || !/<script>[^]+<\/script>/.test(html)) {
    throw Error("Packaged HTML is missing the canvas or inline game code");
  }
  if (/https?:|(?:src|href)=["']\/\//i.test(html)) {
    throw Error("Packaged HTML contains an external resource reference");
  }
  console.log("Validated top-level index.html and offline resources");
}

async function pack() {
  await build();
  mkdirSync(releaseDir, { recursive: true });
  if (existsSync(outputZip)) rmSync(outputZip);
  execFileSync("zip", ["-X", "-9", "-j", outputZip, outputHtml], {
    stdio: "inherit",
  });
  validate();
  reportSize();
}

const command = process.argv[2];

if (command === "build") await build();
else if (command === "pack" || command === "check") await pack();
else if (command === "size") reportSize();
else throw Error("Use build, pack, size, or check");
