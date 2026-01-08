import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let ApiPaths = {};

const routeFiles = fs.readdirSync(__dirname).filter(
  (file) =>
    file.endsWith(".js") &&
    !["index.js", "api-docs.js"].includes(file)
);

for (const file of routeFiles) {
  const module = await import(`./${file}`);
  const routeDocs = module.default || module;
  ApiPaths = { ...ApiPaths, ...routeDocs };
}

export default ApiPaths;
