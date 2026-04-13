/**
 * GitHub Pages 用に docs/ を生成します。
 * node_modules のファイルを vendor にまとめ、パスを書き換えます。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const docs = path.join(root, "docs");
const vendor = path.join(docs, "vendor");

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

fs.rmSync(docs, { recursive: true, force: true });
fs.mkdirSync(vendor, { recursive: true });

copyFile(path.join(root, "styles.css"), path.join(docs, "styles.css"));

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
html = html.replace(
  "./node_modules/pdf-lib/dist/pdf-lib.min.js",
  "./vendor/pdf-lib.min.js"
);
html = html.replace(/src="\.\/app\.js[^"]*"/, 'src="./app.js"');
fs.writeFileSync(path.join(docs, "index.html"), html);

let appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
appJs = appJs.replace(
  'from "./node_modules/pdfjs-dist/legacy/build/pdf.mjs"',
  'from "./vendor/pdf.mjs"'
);
appJs = appJs.replace(
  '"./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"',
  '"./vendor/pdf.worker.mjs"'
);
fs.writeFileSync(path.join(docs, "app.js"), appJs);

copyFile(
  path.join(root, "node_modules/pdf-lib/dist/pdf-lib.min.js"),
  path.join(vendor, "pdf-lib.min.js")
);
copyFile(
  path.join(root, "node_modules/pdfjs-dist/legacy/build/pdf.mjs"),
  path.join(vendor, "pdf.mjs")
);
copyFile(
  path.join(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
  path.join(vendor, "pdf.worker.mjs")
);

console.log("OK: docs/ を生成しました（GitHub Pages の公開フォルダ）");
