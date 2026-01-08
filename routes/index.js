import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainRouter = express.Router();
const routesPath = __dirname;

const routeFiles = fs.readdirSync(routesPath).filter(
  file => file !== "index.js" && file.endsWith(".js")
);

async function loadRoutes() {
  await Promise.all(routeFiles.map(async (file) => {
    try {
      const routeName = path.basename(file, ".js");
      const filePath = path.join(routesPath, file);
      const { default: routeModule } = await import(filePath);

      if (typeof routeModule === 'function') {
        mainRouter.use(`/${routeName}`, routeModule);
        console.log(`✅ Route loaded: /${routeName}`);
      } else if (routeModule?.router) {
        mainRouter.use(`/${routeName}`, routeModule.router);
        console.log(`✅ Route loaded: /${routeName}`);
      } else {
        console.warn(`⚠️  Route ${file} exported invalid format`);
      }
    } catch (err) {
      console.error(`❌ Failed to load route ${file}:`, err);
      // Optional: throw err to stop server if route loading is critical
    }
  }));

  return mainRouter;
}

export default await loadRoutes();