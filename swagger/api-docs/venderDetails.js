const paths = {
  "/api/v1/vendor/create": {
    post: {
      tags: ["Vendor"],
      summary: "Create Vendor with Profile",
      description:
        "Creates a vendor user and stores their business details in the system",
      operationId: "createVendor",
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          in: "body",
          name: "body",
          description: "Vendor registration details",
          required: true,
          schema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                example: "vendor@example.com",
              },
              password: {
                type: "string",
                example: "Vendor@123",
              },
              businessName: {
                type: "string",
                example: "Aleppo Fresh Market",
              },
              ownerName: {
                type: "string",
                example: "Ahmad Al-Khatib",
              },
              commercialRegNo: {
                type: "string",
                example: "CR-983472",
              },
              vatOrTaxId: {
                type: "string",
                example: "TAX-SYR-5481",
              },
              nationalIdNumber: {
                type: "string",
                example: "SYR123456789",
              },
              businessPhone: {
                type: "string",
                example: "+963945678901",
              },
              whatsappNumber: {
                type: "string",
                example: "+963934567890",
              },
              location: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["Point"],
                    example: "Point",
                  },
                  coordinates: {
                    type: "array",
                    items: { type: "number" },
                    example: [37.1586, 36.2021],
                  },
                },
              },
              address: {
                type: "object",
                properties: {
                  street: { type: "string", example: "Al-Fardous Street" },
                  district: { type: "string", example: "Old City" },
                  city: { type: "string", example: "Aleppo" },
                  country: { type: "string", example: "Syria" },
                },
              },
              deliveryHours: {
                type: "string",
                example: "09:00 AM - 06:00 PM",
              },
              businessLogo: {
                type: "string",
                example: "https://example.com/uploads/logo.png",
              },
              category: {
                type: "string",
                example: "Grocery",
              },
              licenseDocument: {
                type: "string",
                example: "https://example.com/uploads/license.pdf",
              },
              bankOrMobilePayInfo: {
                type: "string",
                example: "SyriaPay-987654321",
              },
            },
            required: [
              "email",
              "password",
              "businessName",
              "ownerName",
              "commercialRegNo",
              "nationalIdNumber",
              "businessPhone",
              "location",
              "address",
              "deliveryHours",
              "category",
              "licenseDocument",
            ],
          },
        },
      ],
      responses: {
        200: {
          description: "Vendor created successfully",
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Vendor created successfully.",
              },
              user: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  email: { type: "string" },
                  role: { type: "number", example: 20 },
                },
              },
              vendorDetail: {
                type: "object",
                properties: {
                  _id: { type: "string", example: "60f6d13e9f1b2c001c8d4b12" },
                  userId: {
                    type: "object",
                    properties: {
                      _id: {
                        type: "string",
                        example: "60f6d13e9f1b2c001c8d4aaa",
                      },
                      email: { type: "string", example: "vendor@example.com" },
                    },
                  },
                  businessName: {
                    type: "string",
                    example: "Aleppo Fresh Market",
                  },
                  ownerName: { type: "string", example: "Ahmad Al-Khatib" },
                  commercialRegNo: { type: "string", example: "CR-983472" },
                  vatOrTaxId: { type: "string", example: "TAX-SYR-5481" },
                  nationalIdNumber: { type: "string", example: "SYR123456789" },
                  businessPhone: { type: "string", example: "+963945678901" },
                  whatsappNumber: { type: "string", example: "+963934567890" },
                  location: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["Point"],
                        example: "Point",
                      },
                      coordinates: {
                        type: "array",
                        items: { type: "number" },
                        example: [37.1586, 36.2021],
                      },
                    },
                  },
                  address: {
                    type: "object",
                    properties: {
                      street: { type: "string", example: "Al-Fardous Street" },
                      district: { type: "string", example: "Old City" },
                      city: { type: "string", example: "Aleppo" },
                      country: { type: "string", example: "Syria" },
                    },
                  },
                  deliveryHours: {
                    type: "string",
                    example: "09:00 AM - 06:00 PM",
                  },
                  businessLogo: {
                    type: "string",
                    example: "https://example.com/uploads/logo.png",
                  },
                  category: { type: "string", example: "Grocery" },
                  licenseDocument: {
                    type: "string",
                    example: "https://example.com/uploads/license.pdf",
                  },
                  bankOrMobilePayInfo: {
                    type: "string",
                    example: "SyriaPay-987654321",
                  },
                  status: {
                    type: "string",
                    enum: ["Pending", "Approved", "Rejected"],
                    example: "Pending",
                  },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-12T14:35:00Z",
                  },
                  updatedAt: {
                    type: "string",
                    format: "date-time",
                    example: "2025-06-13T08:12:00Z",
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
          description: "Server error while creating vendor",
        },
      },
    },
  },
  "/api/v1/vendor/pending": {
    get: {
      tags: ["Vendor"],
      summary: "Get All Pending Vendors",
      description:
        "Returns a list of vendors with status 'pending', along with their associated email addresses. Admin token is required.",
      operationId: "getPendingVendors",
      security: [
        {
          bearerAuth: [],
        },
      ],
      produces: ["application/json"],
      responses: {
        200: {
          description: "Pending vendors fetched successfully",
          schema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string", example: "vendor123" },
                businessName: {
                  type: "string",
                  example: "Aleppo Fresh Market",
                },
                ownerName: { type: "string", example: "Ahmad Al-Khatib" },
                status: { type: "string", example: "pending" },
                userId: {
                  type: "object",
                  properties: {
                    _id: { type: "string", example: "user456" },
                    email: { type: "string", example: "vendor@example.com" },
                  },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized or invalid token",
        },
        500: {
          description: "Internal server error",
        },
      },
    },
  },
  "/api/v1/vendor/update/status": {
    post: {
      tags: ["Vendor"],
      summary: "Update Vendor Status",
      description:
        "Updates a vendor's status to either 'Approved' or 'Rejected'. Admin token is required.",
      operationId: "updateVendorStatus",
      consumes: ["application/json"],
      produces: ["application/json"],
      security: [
        {
          bearerAuth: [],
        },
      ],
      parameters: [
        {
          in: "body",
          name: "body",
          required: true,
          description: "Vendor ID and status to update",
          schema: {
            type: "object",
            required: ["vendorId", "status"],
            properties: {
              vendorId: {
                type: "string",
                example: "64fd123456abc7890def4567",
              },
              status: {
                type: "string",
                enum: ["Approved", "Rejected"],
                example: "Approved",
              },
            },
          },
        },
      ],
      responses: {
        200: {
          description: "Vendor status updated successfully",
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                example: "Vendor status updated to 'Approved' successfully.",
              },
              data: {
                type: "object",
                properties: {
                  _id: { type: "string", example: "vendor123" },
                  businessName: {
                    type: "string",
                    example: "Aleppo Fresh Market",
                  },
                  ownerName: {
                    type: "string",
                    example: "Ahmad Al-Khatib",
                  },
                  status: {
                    type: "string",
                    example: "Approved",
                  },
                  userId: {
                    type: "object",
                    properties: {
                      _id: { type: "string", example: "user456" },
                      email: { type: "string", example: "vendor@example.com" },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Invalid vendor ID or status value",
        },
        401: {
          description: "Unauthorized or invalid token",
        },
        500: {
          description: "Internal server error",
        },
      },
    },
  },
  "/api/v1/vendor/": {
    get: {
      tags: ["Vendor"],
      summary: "Get Vendor Details",
      description:
        "Fetches the vendor details for the authenticated user. Requires vendor token.",
      operationId: "getVendorDetails",
      security: [
        {
          bearerAuth: [],
        },
      ],
      produces: ["application/json"],
      responses: {
        200: {
          description: "Vendor details fetched successfully",
          schema: {
            type: "object",
            properties: {
              _id: { type: "string", example: "vendor123" },
              businessName: { type: "string", example: "Aleppo Fresh Market" },
              ownerName: { type: "string", example: "Ahmad Al-Khatib" },
              status: { type: "string", example: "Approved" },
              userId: {
                type: "object",
                properties: {
                  _id: { type: "string", example: "user456" },
                  email: { type: "string", example: "vendor@example.com" },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized or invalid token",
        },
        500: {
          description: "Internal server error",
        },
      },
    },
  },
  
};

export default paths;
