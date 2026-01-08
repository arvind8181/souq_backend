const paths = {
  "/api/v1/product/create": {
    post: {
      tags: ["Vendor"],
      summary: "Create Product (Vendor only)",
      description:
        "Allows an authenticated vendor to create a new product. Requires Bearer token authentication.",
      operationId: "createProduct",
      security: [
        {
          bearerAuth: [],
        },
      ],
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          in: "body",
          name: "body",
          description: "Product creation details",
          required: true,
          schema: {
            type: "object",
            properties: {
              productName: {
                type: "string",
                example: "Organic Olive Oil",
              },
              description: {
                type: "string",
                example:
                  "Cold-pressed extra virgin olive oil from rural Syria.",
              },
              category: {
                type: "string",
                example: "Grocery",
              },
              subCategory: {
                type: "string",
                example: "Cooking Oils",
              },
              price: {
                type: "number",
                example: 25.5,
              },
              discountPrice: {
                type: "number",
                example: 20.0,
              },
              unit: {
                type: "string",
                example: "1L Bottle",
              },
              stockQuantity: {
                type: "integer",
                example: 100,
              },
              images: {
                type: "array",
                items: { type: "string", format: "uri" },
                example: [
                  "https://example.com/images/oliveoil1.png",
                  "https://example.com/images/oliveoil2.png",
                ],
              },
              videoURL: {
                type: "string",
                format: "uri",
                example: "https://example.com/videos/product-demo.mp4",
              },
              deliveryTimeEstimate: {
                type: "string",
                example: "1-3 business days",
              },
              isAvailable: {
                type: "boolean",
                example: true,
              },
              isCODAvailable: {
                type: "boolean",
                example: true,
              },
              tags: {
                type: "array",
                items: { type: "string" },
                example: ["organic", "olive", "cooking"],
              },
            },
            required: [
              "productName",
              "category",
              "price",
              "unit",
              "stockQuantity",
            ],
          },
        },
      ],
      responses: {
        201: {
          description: "Product created successfully",
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Product created successfully.",
              },
              data: {
                type: "object",
                properties: {
                  _id: { type: "string", example: "60f6d13e9f1b2c001c8d4abc" },
                  productName: { type: "string", example: "Organic Olive Oil" },
                  vendorId: {
                    type: "string",
                    example: "60f6d13e9f1b2c001c8d4vendor",
                  },
                  price: { type: "number", example: 25.5 },
                  discountPrice: { type: "number", example: 20.0 },
                  stockQuantity: { type: "integer", example: 100 },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-17T10:30:00Z",
                  },
                  updatedAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-17T10:30:00Z",
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Validation failed or missing fields",
        },
        401: {
          description: "Unauthorized - Missing or invalid token",
        },
        403: {
          description: "Access denied - Only vendors can create products",
        },
        500: {
          description: "Internal server error during product creation",
        },
      },
    },
  },
  "/api/v1/product/": {
    get: {
      tags: ["Product"],
      summary: "Get All Products (Vendor only)",
      description:
        "Retrieve all products created by the authenticated vendor. Requires Bearer token authentication.",
      operationId: "getVendorProducts",
      security: [{ bearerAuth: [] }],
      produces: ["application/json"],
      responses: {
        200: {
          description: "List of products",
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Products retrieved successfully.",
              },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    _id: {
                      type: "string",
                      example: "60f6d13e9f1b2c001c8d4abc",
                    },
                    productName: {
                      type: "string",
                      example: "Organic Olive Oil",
                    },
                    vendorId: {
                      type: "object",
                      properties: {
                        _id: {
                          type: "string",
                          example: "60f6d13e9f1b2c001c8d4vendor",
                        },
                        businessName: {
                          type: "string",
                          example: "Syria Naturals",
                        },
                        category: { type: "string", example: "Grocery" },
                      },
                    },
                    price: { type: "number", example: 25.5 },
                    discountPrice: { type: "number", example: 20.0 },
                    stockQuantity: { type: "integer", example: 100 },
                    createdAt: {
                      type: "string",
                      format: "date-time",
                      example: "2025-06-17T10:30:00Z",
                    },
                    updatedAt: {
                      type: "string",
                      format: "date-time",
                      example: "2025-06-17T10:30:00Z",
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized - Missing or invalid token" },
        500: { description: "Internal server error while retrieving products" },
      },
    },
  },
  "/api/v1/product/update/{productId}": {
    put: {
      tags: ["Product"],
      summary: "Update Product (Vendor only)",
      description:
        "Update an existing product owned by the authenticated vendor. Requires Bearer token authentication.",
      operationId: "updateProduct",
      security: [{ bearerAuth: [] }],
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          name: "productId",
          in: "path",
          required: true,
          description: "ID of the product to update",
          type: "string",
          example: "60f6d13e9f1b2c001c8d4abc",
        },
        {
          in: "body",
          name: "body",
          description: "Product update payload",
          required: true,
          schema: {
            type: "object",
            properties: {
              productName: {
                type: "string",
                example: "Updated Organic Olive Oil",
              },
              description: {
                type: "string",
                example: "Cold-pressed olive oil from Syria",
              },
              category: { type: "string", example: "Grocery" },
              subCategory: { type: "string", example: "Oil" },
              price: { type: "number", example: 25.5 },
              discountPrice: { type: "number", example: 20.0 },
              unit: { type: "string", example: "500ml" },
              stockQuantity: { type: "integer", example: 100 },
              images: {
                type: "array",
                items: { type: "string" },
                example: ["image1.jpg", "image2.jpg"],
              },
              videoURL: {
                type: "string",
                example: "https://youtu.be/video123",
              },
              deliveryTimeEstimate: {
                type: "string",
                example: "3-5 business days",
              },
              isAvailable: { type: "boolean", example: true },
              isCODAvailable: { type: "boolean", example: true },
              tags: {
                type: "array",
                items: { type: "string" },
                example: ["organic", "cold-pressed"],
              },
            },
          },
        },
      ],
      responses: {
        200: {
          description: "Product updated successfully",
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Product updated successfully.",
              },
              data: {
                type: "object",
                properties: {
                  _id: { type: "string", example: "60f6d13e9f1b2c001c8d4abc" },
                  productName: {
                    type: "string",
                    example: "Updated Organic Olive Oil",
                  },
                  vendorId: {
                    type: "string",
                    example: "60f6d13e9f1b2c001c8d4vendor",
                  },
                  price: { type: "number", example: 25.5 },
                  discountPrice: { type: "number", example: 20.0 },
                  stockQuantity: { type: "integer", example: 100 },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-17T10:30:00Z",
                  },
                  updatedAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-23T12:00:00Z",
                  },
                },
              },
            },
          },
        },
        400: { description: "Bad request or invalid vendor" },
        401: { description: "Unauthorized - Missing or invalid token" },
        404: { description: "Product not found or unauthorized" },
        500: { description: "Internal server error while updating product" },
      },
    },
  },
  "/api/v1/product/delete/{productId}": {
    delete: {
      tags: ["Product"],
      summary: "Delete Product (Vendor only)",
      description:
        "Delete an existing product owned by the authenticated vendor. Requires Bearer token authentication.",
      operationId: "deleteProduct",
      security: [{ bearerAuth: [] }],
      produces: ["application/json"],
      parameters: [
        {
          name: "productId",
          in: "path",
          required: true,
          description: "ID of the product to delete",
          type: "string",
          example: "60f6d13e9f1b2c001c8d4abc",
        },
      ],
      responses: {
        200: {
          description: "Product deleted successfully",
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Product deleted successfully.",
              },
            },
          },
        },
        400: { description: "Bad request or invalid vendor" },
        401: { description: "Unauthorized - Missing or invalid token" },
        404: { description: "Product not found or unauthorized" },
        500: { description: "Internal server error while deleting product" },
      },
    },
  },
};

export default paths;
