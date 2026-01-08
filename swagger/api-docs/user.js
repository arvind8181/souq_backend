const paths = {
  "/api/v1/user/create": {
    post: {
      tags: ["User"],
      summary: "Create Account",
      description: "Creates a new main admin user with role 10",
      operationId: "createMainAdmin",
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          in: "body",
          name: "body",
          description: "Email and password required to create main admin",
          required: true,
          schema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                example: "admin@example.com",
              },
              fullName: {
                type: "string",
                example: "John Doe",  
              },
              password: {
                type: "string",
                example: "Admin@123",
                description:
                  "At least 6 characters, one uppercase, one number, one special char",
              },
              role: {
                type: "number",
                enum: [10],
                example: 10,
                description: "Must be 10 (Main Admin)",
              },
            },
            required: ["email", "password", "role"],
          },
        },
      ],
      responses: {
        200: {
          description: "Main admin created successfully",
        },
        400: {
          description: "Email and password are required / Validation failed",
        },
        409: {
          description: "User already exists",
        },
        500: {
          description: "Failed to create main admin",
        },
      },
    },
  },
  "/api/v1/user/login": {
    post: {
      tags: ["User"],
      summary: "Login ",
      description: "Logs in an existing user and returns a JWT token",
      operationId: "login",
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          in: "body",
          name: "body",
          description: "Email and password required to login",
          required: true,
          schema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                example: "admin@example.com",
              },
              password: {
                type: "string",
                example: "Admin@123",
                description: "Password of the main admin",
              },
            },
            required: ["email", "password"],
          },
        },
      ],
      responses: {
        200: {
          description: "Login successful",
          schema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "JWT access token",
              },
              user: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  email: { type: "string" },
                  role: { type: "number" },
                  // Add other user fields if needed
                },
              },
            },
          },
        },
        400: {
          description: "Email and password are required",
        },
        401: {
          description: "Invalid email or password",
        },
        500: {
          description: "Internal server error",
        },
      },
    },
  },
  "/api/v1/user/forgot/password": {
    post: {
      tags: ["User"],
      summary: "Send OTP for Password Reset",
      description:
        "Sends a 6-digit OTP to the user's email and returns a temporary reset token valid for 15 minutes.",
      operationId: "forgotPassword",
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          in: "body",
          name: "body",
          description: "Email address to receive OTP",
          required: true,
          schema: {
            type: "object",
            properties: {
              email: {
                type: "string",
                format: "email",
                example: "user@example.com",
              },
            },
            required: ["email"],
          },
        },
      ],
      responses: {
        200: {
          description: "OTP sent successfully",
        },
        400: {
          description: "Email is required",
        },
        401: {
          description: "Invalid email",
        },
        500: {
          description: "Failed to process forgot password",
        },
      },
    },
  },
  "/api/v1/user/verify/otp": {
    post: {
      tags: ["User"],
      summary: "Verify OTP",
      description:
        "Verifies a user's OTP and returns a short-lived token (10 mins) for password reset confirmation.",
      operationId: "verifyOtp",
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          in: "body",
          name: "body",
          description: "OTP and token from the forgot password request",
          required: true,
          schema: {
            type: "object",
            properties: {
              otp: {
                type: "string",
                example: "123456",
              },
              token: {
                type: "string",
                example: "jwt.token.here",
              },
            },
            required: ["otp", "token"],
          },
        },
      ],
      responses: {
        200: {
          description: "OTP verified successfully, reset token issued",
        },
        400: {
          description: "OTP and token are required",
        },
        401: {
          description: "Invalid or expired token or OTP",
        },
        500: {
          description: "OTP verification failed",
        },
      },
    },
  },
  "/api/v1/user/reset/password": {
    post: {
      tags: ["User"],
      summary: "Reset Password",
      description: "Resets the user's password using a verified OTP token.",
      operationId: "resetPasswordConfirm",
      consumes: ["application/json"],
      produces: ["application/json"],
      parameters: [
        {
          in: "body",
          name: "body",
          description: "New password and token from OTP verification",
          required: true,
          schema: {
            type: "object",
            properties: {
              newPassword: {
                type: "string",
                format: "password",
                example: "NewStrongPassword@123",
              },
              token: {
                type: "string",
                example: "jwt.confirm.token",
              },
            },
            required: ["newPassword", "token"],
          },
        },
      ],
      responses: {
        200: {
          description: "Password reset successful",
        },
        400: {
          description: "Password and token are required",
        },
        401: {
          description: "Invalid or expired token or OTP",
        },
        500: {
          description: "Failed to reset password",
        },
      },
    },
  },
};

export default paths;
