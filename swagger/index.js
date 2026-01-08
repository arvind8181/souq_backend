import { serve, setup } from "swagger-ui-express";
import expressBasicAuth from "express-basic-auth";
import ApiPaths from "./api-docs/index.js";

const swaggerDocs = {
  swagger: "2.0",
  info: {
    description: "Dual Market Place API Documentation",
    version: "1.0.0",
    title: "Dual Market Place API",
  },
  host: `${process.env.IP}:${process.env.PORT}`,
  basePath: "/",
  tags: [
    { name: "User", description: "User-related APIs" },
  ],
  schemes: ["http"],
  paths: ApiPaths,
  securityDefinitions: {
    bearerAuth: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
      description: "Enter your bearer token in the format: Bearer token",
    },
  },
};

const swaggerRoute = (app) => {
  app.use(
    "/api/swagger-docs",
    expressBasicAuth({
      users: { swagger: "q2nd78@x4" },
      challenge: true,
      realm: "SwaggerDocs",
    }),
    (req, res, next) => {
      swaggerDocs.host = req.get("host");
      next();
    },
    serve,
    setup(swaggerDocs)
  );
};

export default { swaggerRoute };
