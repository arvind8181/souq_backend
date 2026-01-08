/* swagger/paths/order.js ----------------------------------------------- */
const paths = {
  "/api/v1/order/create": {
    post: {
      tags: ["Customer"],
      summary: "Place Order (Customer only)",
      description:
        "Allows an authenticated **customer** to place an order for a single product. Stock is checked atomically; fails if requested quantity exceeds available stock.",
      operationId: "createOrder",
      security: [
        {
          bearerAuth: [], // JWT in Authorization header
        },
      ],
      consumes: ["application/json"],
      produces: ["application/json"],

      /* ---------------------------------------------------------- */
      /*  Request body                                              */
      /* ---------------------------------------------------------- */
      parameters: [
        {
          in: "body",
          name: "body",
          description: "Order details",
          required: true,
          schema: {
            type: "object",
            properties: {
              productId: {
                type: "string",
                description: "24-character Mongo ObjectId of the product",
                example: "60f6d13e9f1b2c001c8d4abc",
              },
              quantity: {
                type: "integer",
                minimum: 1,
                example: 2,
              },
              subTotal: {
                type: "number",
                minimum: 0,
                example: 49.98,
              },
              shippingFee: {
                type: "number",
                minimum: 0,
                example: 5.0,
              },
              grandTotal: {
                type: "number",
                minimum: 0,
                example: 54.98,
              },
              type: {
                type: "integer",
                enum: [1, 2],
                example: 1,
                description:
                  "1 = regular order, 2 = something else (business rule)",
              },
              deliveryAddress: {
                type: "object",
                required: ["address", "city", "country"],
                properties: {
                  address: { type: "string", example: "221B Baker Street" },
                  city: { type: "string", example: "London" },
                  country: { type: "string", example: "UK" },
                },
              },
              notes: {
                type: "string",
                example: "Please leave at the front desk.",
              },
            },
            required: [
              "productId",
              "quantity",
              "subTotal",
              "shippingFee",
              "grandTotal",
              "type",
              "deliveryAddress",
            ],
          },
        },
      ],

      /* ---------------------------------------------------------- */
      /*  Responses                                                 */
      /* ---------------------------------------------------------- */
      responses: {
        201: {
          description: "Order placed successfully",
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Order placed successfully.",
              },
              data: {
                type: "object",
                properties: {
                  _id: { type: "string", example: "65b2e1f73fd9461b9d144b32" },
                  productId: {
                    type: "string",
                    example: "60f6d13e9f1b2c001c8d4abc",
                  },
                  vendorId: {
                    type: "string",
                    example: "60f6d13e9f1b2c001c8d4vendor",
                  },
                  customerId: {
                    type: "string",
                    example: "60f6d13e9f1b2c001c8d4cust",
                  },
                  quantity: { type: "integer", example: 2 },
                  subTotal: { type: "number", example: 49.98 },
                  shippingFee: { type: "number", example: 5.0 },
                  grandTotal: { type: "number", example: 54.98 },
                  status: { type: "string", example: "pending" },
                  paymentStatus: { type: "string", example: "unpaid" },
                  type: { type: "integer", example: 1 },
                  deliveryAddress: {
                    type: "object",
                    properties: {
                      address: { type: "string", example: "221B Baker Street" },
                      city: { type: "string", example: "London" },
                      country: { type: "string", example: "UK" },
                    },
                  },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-25T10:45:00Z",
                  },
                  updatedAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-25T10:45:00Z",
                  },
                },
              },
            },
          },
        },

        400: {
          description:
            "Validation failed, insufficient stock, or other bad input",
        },
        401: {
          description: "Unauthorized – Missing/invalid bearer token",
        },
        403: {
          description: "Access denied – Only customers may place orders",
        },
        404: {
          description: "Product not found or not available",
        },
        500: {
          description: "Internal server error while creating order",
        },
      },
    },
  },
};

export default paths;
