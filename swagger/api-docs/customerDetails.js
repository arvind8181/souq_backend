const customerPaths = {
  "/api/v1/customer/create": {
    post: {
      tags: ["Customer"],
      summary: "Create Customer",
      description: "Registers a new customer with basic profile details.",
      operationId: "createCustomer",
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          in: "body",
          name: "body",
          description: "Customer registration details",
          required: true,
          schema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                example: "customer@example.com",
              },
              password: {
                type: "string",
                example: "Customer@123",
              },
              FullName: {
                type: "string",
                example: "John Doe",
              },
            },
            required: ["email", "password", "FullName"],
          },
        },
      ],
      responses: {
        200: {
          description: "Customer created successfully",
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Customer created successfully.",
              },
              user: {
                type: "object",
                properties: {
                  _id: { type: "string", example: "60f6d13e9f1b2c001c8d4abc" },
                  email: { type: "string", example: "customer@example.com" },
                  role: { type: "number", example: 3 },
                },
              },
              customerDetail: {
                type: "object",
                properties: {
                  _id: { type: "string", example: "60f6d13e9f1b2c001c8d4def" },
                  userId: {
                    type: "object",
                    properties: {
                      _id: {
                        type: "string",
                        example: "60f6d13e9f1b2c001c8d4abc",
                      },
                      email: {
                        type: "string",
                        example: "customer@example.com",
                      },
                    },
                  },
                  FullName: {
                    type: "string",
                    example: "John Doe",
                  },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-23T10:00:00Z",
                  },
                  updatedAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-23T10:15:00Z",
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Validation failed or required fields missing",
        },
        409: {
          description: "User already exists",
        },
        500: {
          description: "Server error while creating customer",
        },
      },
    },
  },
};

export default customerPaths;
