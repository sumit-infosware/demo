import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env.js";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "HAL SIT API",
      version: "1.0.0",
      description: "API documentation for HAL SIT backend services",
      contact: {
        name: "API Support",
        email: "support@example.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/v1`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token obtained from login endpoint",
        },
      },
      schemas: {
        // Request schemas
        RegisterRequest: {
          type: "object",
          required: ["email", "password", "firstName", "lastName"],
          properties: {
            email: {
              type: "string",
              format: "email",
              maxLength: 254,
              description: "User's email address",
              example: "john@example.com",
            },
            password: {
              type: "string",
              minLength: 8,
              maxLength: 128,
              description: "User's password (min 8, max 128 characters)",
              example: "StrongPassword123!",
            },
            firstName: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "User's first name",
              example: "John",
            },
            lastName: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "User's last name",
              example: "Doe",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
              example: "john@example.com",
            },
            password: {
              type: "string",
              minLength: 1,
              description: "User's password",
              example: "StrongPassword123!",
            },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["username", "oldPassword", "newPassword", "confirmNewPassword"],
          properties: {
            username: {
              type: "string",
              minLength: 3,
              maxLength: 80,
              description: "Username (email) of the account whose password is being changed",
              example: "john@example.com",
            },
            oldPassword: {
              type: "string",
              minLength: 1,
              description: "The user's current password (used to verify identity)",
              example: "OldStrongPassword123!",
            },
            newPassword: {
              type: "string",
              minLength: 8,
              maxLength: 128,
              description:
                "New password. Must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character. Hashed server-side.",
              example: "NewStrongPassword123!",
            },
            confirmNewPassword: {
              type: "string",
              minLength: 8,
              maxLength: 128,
              description: "Must exactly match newPassword",
              example: "NewStrongPassword123!",
            },
          },
        },
        RefreshTokenRequest: {
          type: "object",
          properties: {
            refreshToken: {
              type: "string",
              description:
                "Refresh token. Optional — if omitted, the httpOnly refresh_token cookie is used instead.",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },
        LogoutRequest: {
          type: "object",
          properties: {
            refreshToken: {
              type: "string",
              description:
                "Refresh token. Optional — if omitted, the httpOnly refresh_token cookie is used instead.",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },
        // Response schemas
        UserResponse: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique user identifier",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
              example: "john@example.com",
            },
            firstName: {
              type: "string",
              description: "User's first name",
              example: "John",
            },
            lastName: {
              type: "string",
              description: "User's last name",
              example: "Doe",
            },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            user: {
              $ref: "#/components/schemas/UserResponse",
            },
            accessToken: {
              type: "string",
              description: "JWT access token for authentication",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refreshToken: {
              type: "string",
              description: "JWT refresh token for obtaining new access tokens",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Health check live succesfull.",
            },
            status: {
              type: "integer",
              example: 200,
            },
            response: {
              type: "null",
              nullable: true,
            },
          },
        },
        // Error schemas
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  example: "VALIDATION_ERROR",
                },
                message: {
                  type: "string",
                  example: "Validation failed",
                },
                details: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: {
                        type: "string",
                        example: "email",
                      },
                      message: {
                        type: "string",
                        example: "Invalid email format",
                      },
                    },
                  },
                },
                stack: {
                  type: "string",
                  description: "Stack trace (only in development)",
                },
              },
            },
            requestId: {
              type: "string",
              description: "Unique request identifier for tracing",
              example: "req-abc123",
            },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
              description: "Response data (varies by endpoint)",
            },
            requestId: {
              type: "string",
              description: "Unique request identifier for tracing",
              example: "req-abc123",
            },
          },
        },
        // User management schemas
        UserDetailResponse: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique user identifier",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
              example: "john@example.com",
            },
            firstName: {
              type: "string",
              description: "User's first name",
              example: "John",
            },
            lastName: {
              type: "string",
              description: "User's last name",
              example: "Doe",
            },
            isActive: {
              type: "boolean",
              description: "Whether the user account is active",
              example: true,
            },
            roles: {
              type: "array",
              description: "Role names assigned to the user",
              items: {
                type: "string",
                example: "admin",
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
              example: "2026-01-01T10:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
              example: "2026-01-02T12:30:00.000Z",
            },
          },
        },
        UserListResponse: {
          type: "object",
          properties: {
            users: {
              type: "array",
              items: {
                $ref: "#/components/schemas/UserDetailResponse",
              },
            },
            pagination: {
              type: "object",
              properties: {
                page: {
                  type: "integer",
                  example: 1,
                },
                limit: {
                  type: "integer",
                  example: 20,
                },
                total: {
                  type: "integer",
                  example: 42,
                },
                totalPages: {
                  type: "integer",
                  example: 3,
                },
              },
            },
          },
        },
        AssignRoleRequest: {
          type: "object",
          required: ["role"],
          properties: {
            role: {
              type: "string",
              description: "Name of the role to assign (replaces any existing roles)",
              example: "editor",
            },
          },
        },
        AssignRoleResponse: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              format: "uuid",
              description: "Identifier of the user the role was assigned to",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            role: {
              type: "string",
              description: "Name of the assigned role",
              example: "editor",
            },
          },
        },
        UserCreateRequest: {
          type: "object",
          required: ["email", "password", "firstName", "lastName", "roleId"],
          properties: {
            email: {
              type: "string",
              format: "email",
              maxLength: 254,
              description: "User's email address (used for login)",
              example: "jane@example.com",
            },
            password: {
              type: "string",
              minLength: 8,
              maxLength: 128,
              description: "Initial password (min 8, max 128 characters). Hashed server-side.",
              example: "StrongPassword123!",
            },
            firstName: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "User's first name",
              example: "Jane",
            },
            lastName: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "User's last name",
              example: "Smith",
            },
            roleId: {
              type: "string",
              format: "uuid",
              description: "Id of the role to assign to the new user",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        },
        UserUpdateRequest: {
          type: "object",
          properties: {
            email: {
              type: "string",
              format: "email",
              maxLength: 254,
              description: "User's email address",
              example: "jane@example.com",
            },
            password: {
              type: "string",
              minLength: 8,
              maxLength: 128,
              description:
                "New password. If omitted, the existing password is kept. Hashed server-side.",
              example: "NewStrongPassword123!",
            },
            firstName: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "User's first name",
              example: "Jane",
            },
            lastName: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "User's last name",
              example: "Smith",
            },
            isActive: {
              type: "boolean",
              description: "Whether the user account is active",
              example: true,
            },
            roleId: {
              type: "string",
              format: "uuid",
              description:
                "Id of the role to assign. Changing a role requires the roles.update permission.",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        },
        // RBAC schemas
        PermissionResponse: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique permission identifier",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            code: {
              type: "string",
              description: "Unique permission code",
              example: "user.read",
            },
            description: {
              type: "string",
              description: "Human-readable description of the permission",
              example: "Allows reading user records",
            },
          },
        },
        RoleResponse: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique role identifier",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            name: {
              type: "string",
              description: "Unique role name",
              example: "admin",
            },
            description: {
              type: "string",
              description: "Human-readable description of the role",
              example: "Full administrative access",
            },
            isSystem: {
              type: "boolean",
              description: "Whether the role is a protected system role",
              example: false,
            },
            permissions: {
              type: "array",
              description: "Permissions granted by this role",
              items: {
                type: "object",
                properties: {
                  code: {
                    type: "string",
                    example: "user.read",
                  },
                  description: {
                    type: "string",
                    example: "Allows reading user records",
                  },
                },
              },
            },
          },
        },
        RoleListResponse: {
          type: "array",
          items: {
            $ref: "#/components/schemas/RoleResponse",
          },
        },
        PermissionListResponse: {
          type: "array",
          items: {
            $ref: "#/components/schemas/PermissionResponse",
          },
        },
        // RBAC request schemas
        RoleCreateRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "Unique role name",
              example: "manager",
            },
            description: {
              type: "string",
              maxLength: 255,
              description: "Human-readable description of the role",
              example: "Manages day-to-day operations",
            },
            permissionIds: {
              type: "array",
              description: "Permission ids to assign to the role",
              items: {
                type: "string",
                format: "uuid",
                example: "550e8400-e29b-41d4-a716-446655440000",
              },
            },
          },
        },
        RoleUpdateRequest: {
          type: "object",
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "Unique role name",
              example: "manager",
            },
            description: {
              type: "string",
              nullable: true,
              maxLength: 255,
              description: "Human-readable description of the role (send null to clear)",
              example: "Manages day-to-day operations",
            },
            permissionIds: {
              type: "array",
              description: "Permission ids to assign to the role (fully replaces the existing set)",
              items: {
                type: "string",
                format: "uuid",
                example: "550e8400-e29b-41d4-a716-446655440000",
              },
            },
          },
        },
        PermissionCreateRequest: {
          type: "object",
          required: ["code"],
          properties: {
            code: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Unique permission code (lowercase, dot/underscore separated)",
              example: "roles.create",
            },
            description: {
              type: "string",
              maxLength: 255,
              description: "Human-readable description of the permission",
              example: "Allows creating roles",
            },
          },
        },
        PermissionUpdateRequest: {
          type: "object",
          properties: {
            code: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Unique permission code (lowercase, dot/underscore separated)",
              example: "roles.create",
            },
            description: {
              type: "string",
              nullable: true,
              maxLength: 255,
              description: "Human-readable description of the permission (send null to clear)",
              example: "Allows creating roles",
            },
          },
        },
        // Transit schemas
        TransitReadRequest: {
          type: "object",
          required: ["epcs"],
          properties: {
            readerId: {
              type: "string",
              maxLength: 64,
              description: "Identifier of the RFID reader that performed the bulk read",
              example: "FX9600-01",
            },
            port: {
              type: "integer",
              minimum: 1,
              maximum: 4,
              description: "Reader port the EPCs were captured on (FX9600 4-port reader)",
              example: 1,
            },
            transferId: {
              type: "string",
              maxLength: 40,
              description:
                "Optional Transfer ID. When provided, the read is compared against the Transfer's approved line EPCs for a completeness/rescan answer.",
              example: "TID-20260914-0001",
            },
            epcs: {
              type: "array",
              minItems: 1,
              description: "EPC set captured by the RFID reader at the transit exit",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 64,
                example: "E280689400001",
              },
            },
          },
        },
        TransitEpcResult: {
          type: "object",
          properties: {
            epc: {
              type: "string",
              description: "The EPC as received from the reader",
              example: "E280689400001",
            },
            status: {
              type: "string",
              enum: ["FOUND", "UNKNOWN"],
              description:
                "FOUND — EPC is registered in PacketTag. UNKNOWN — EPC was not found in PacketTag (not tagged / not recognised).",
              example: "FOUND",
            },
          },
        },
        TransitReadResponse: {
          type: "object",
          properties: {
            totalRead: {
              type: "integer",
              description: "Total EPCs received from the reader (before de-duplication)",
              example: 3,
            },
            uniqueRead: {
              type: "integer",
              description: "Number of unique EPCs after removing duplicates",
              example: 3,
            },
            matched: {
              type: "integer",
              description: "Number of unique EPCs registered in PacketTag (FOUND)",
              example: 2,
            },
            unknown: {
              type: "integer",
              description: "Number of unique EPCs not found in PacketTag (UNKNOWN)",
              example: 1,
            },
            duplicates: {
              type: "integer",
              description: "Number of duplicate EPCs removed from the read set",
              example: 0,
            },
            requiresRescan: {
              type: "boolean",
              description:
                "True when a completeness baseline (transferId) was provided and some expected EPCs are still missing. Always false when no transferId was supplied (raw first read before a TID exists).",
              example: false,
            },
            transferId: {
              type: "string",
              nullable: true,
              description: "Transfer the read was checked against; null when none was supplied.",
              example: "TID-20260914-0001",
            },
            complete: {
              type: "boolean",
              nullable: true,
              description:
                "Completeness of the read vs the Transfer's expected EPCs (TransferLines approved subset). null when no transferId was supplied — no completeness claim is made.",
              example: false,
            },
            missingEpcs: {
              type: "array",
              description:
                "Expected EPCs not present in this read (only populated when transferId is supplied)",
              items: {
                type: "string",
                example: "E280689400003",
              },
            },
            epcs: {
              type: "array",
              description: "Per-EPC read result in first-seen de-duplicated order",
              items: {
                $ref: "#/components/schemas/TransitEpcResult",
              },
            },
          },
        },
        // Transit Exit — Charge Approval (RF-22) schemas
        TransitExitChargeCheckRequest: {
          type: "object",
          required: ["epcs"],
          properties: {
            epcs: {
              type: "array",
              minItems: 1,
              description:
                "EPC set captured at the transit exit (RF-21). Charge approval is resolved per RR line the EPCs belong to.",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 64,
                example: "E280689400001",
              },
            },
          },
        },
        TransitExitEpcResult: {
          type: "object",
          properties: {
            epc: {
              type: "string",
              description: "The EPC as received from the reader",
              example: "E280689400001",
            },
            status: {
              type: "string",
              enum: ["FOUND", "UNKNOWN"],
              description:
                "FOUND — EPC is registered in PacketTag and maps to an RR line. UNKNOWN — EPC was not found in PacketTag (no charge check performed).",
              example: "FOUND",
            },
            rrLineId: {
              type: "string",
              nullable: true,
              description: "RR line the EPC maps to; null when the EPC is UNKNOWN.",
              example: "12",
            },
            chargeStatus: {
              type: "string",
              nullable: true,
              enum: ["approved", "pending", "hold", null],
              description:
                "Resolved IFS charge-approval status for the line. approved — charge approved. pending — not yet approved / unknown. hold — IFS/DB unavailable (never assumed approved). null when the EPC is UNKNOWN.",
              example: "approved",
            },
            approved: {
              type: "boolean",
              nullable: true,
              description:
                "Whether the line is approved (true only when chargeStatus === approved). null when the EPC is UNKNOWN.",
              example: true,
            },
          },
        },
        TransitExitLineResult: {
          type: "object",
          properties: {
            rrLineId: {
              type: "string",
              description: "RR line identifier",
              example: "12",
            },
            rrLineNo: {
              type: "string",
              description: "IFS line number of the RR line",
              example: "10",
            },
            rrNo: {
              type: "string",
              description: "IFS receiving report number of the RR line",
              example: "RR-001",
            },
            chargeStatus: {
              type: "string",
              enum: ["approved", "pending", "hold"],
              description: "Resolved IFS charge-approval status for the line.",
              example: "approved",
            },
            source: {
              type: "string",
              enum: ["redis", "ifs", "hold"],
              description:
                "Provenance of the resolved status: redis — served from cache; ifs — read live from the IFS view; hold — IFS unavailable (line never assumed approved).",
              example: "ifs",
            },
            approved: {
              type: "boolean",
              description:
                "Whether the line is approved (true only when chargeStatus === approved).",
              example: true,
            },
            epcs: {
              type: "array",
              description: "EPCs (from the request) that belong to this line",
              items: {
                type: "string",
                example: "E280689400001",
              },
            },
          },
        },
        TransitExitChargeCheckResponse: {
          type: "object",
          properties: {
            totalEpcs: {
              type: "integer",
              description: "Total EPCs received (before de-duplication)",
              example: 3,
            },
            uniqueEpcs: {
              type: "integer",
              description: "Number of unique EPCs after removing duplicates",
              example: 3,
            },
            unknown: {
              type: "integer",
              description: "Number of unique EPCs not found in PacketTag (UNKNOWN)",
              example: 0,
            },
            duplicates: {
              type: "integer",
              description: "Number of duplicate EPCs removed from the request set",
              example: 0,
            },
            approvedLines: {
              type: "integer",
              description: "Number of distinct RR lines whose charge status is approved",
              example: 1,
            },
            pendingLines: {
              type: "integer",
              description: "Number of distinct RR lines whose charge status is pending",
              example: 1,
            },
            holdLines: {
              type: "integer",
              description: "Number of distinct RR lines placed on HOLD (IFS/DB unavailable)",
              example: 0,
            },
            lines: {
              type: "array",
              description: "Per-RR-line charge-approval result (one entry per distinct line)",
              items: {
                $ref: "#/components/schemas/TransitExitLineResult",
              },
            },
            epcs: {
              type: "array",
              description: "Per-EPC charge-approval result in first-seen de-duplicated order",
              items: {
                $ref: "#/components/schemas/TransitExitEpcResult",
              },
            },
          },
        },
        // Transit Exit — Select Approved Subset (RF-23) schemas
        TransitExitSelectApprovedRequest: {
          type: "object",
          required: ["epcs"],
          properties: {
            epcs: {
              type: "array",
              minItems: 1,
              description:
                "EPC set captured at the transit exit (RF-21). The approved subset is derived server-side by re-resolving each RR line's charge status.",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 64,
                example: "E280689400001",
              },
            },
          },
        },
        TransitExitApprovedLine: {
          type: "object",
          description: "An RR line whose charge status is approved (included in dispatch).",
          properties: {
            rrLineId: {
              type: "string",
              description: "RR line identifier",
              example: "12",
            },
            rrLineNo: {
              type: "string",
              description: "IFS line number of the RR line",
              example: "10",
            },
            rrNo: {
              type: "string",
              description: "IFS receiving report number of the RR line",
              example: "RR-001",
            },
            epcs: {
              type: "array",
              description: "Approved EPCs belonging to this line",
              items: {
                type: "string",
                example: "E280689400001",
              },
            },
          },
        },
        TransitExitRemainingLine: {
          type: "object",
          description: "An RR line excluded from the dispatch subset (not approved / unknown).",
          properties: {
            rrLineId: {
              type: "string",
              nullable: true,
              description: "RR line identifier; null when the EPC is UNKNOWN (no PacketTag).",
              example: "13",
            },
            rrLineNo: {
              type: "string",
              description: "IFS line number of the RR line",
              example: "20",
            },
            rrNo: {
              type: "string",
              description: "IFS receiving report number of the RR line",
              example: "RR-001",
            },
            chargeStatus: {
              type: "string",
              nullable: true,
              enum: ["approved", "pending", "hold", null],
              description:
                "Resolved IFS charge-approval status for the line. null when the EPC is UNKNOWN.",
              example: "pending",
            },
            epcs: {
              type: "array",
              description: "EPCs belonging to this line that were NOT selected for dispatch",
              items: {
                type: "string",
                example: "E280689400002",
              },
            },
          },
        },
        TransitExitSelectApprovedResponse: {
          type: "object",
          properties: {
            totalEpcs: {
              type: "integer",
              description: "Total EPCs received (before de-duplication)",
              example: 3,
            },
            uniqueEpcs: {
              type: "integer",
              description: "Number of unique EPCs after removing duplicates",
              example: 3,
            },
            duplicates: {
              type: "integer",
              description: "Number of duplicate EPCs removed from the request set",
              example: 0,
            },
            approvedCount: {
              type: "integer",
              description: "Number of EPCs selected for dispatch (RR line charge status approved)",
              example: 2,
            },
            remainingCount: {
              type: "integer",
              description: "Number of EPCs NOT selected (pending / hold / unknown)",
              example: 1,
            },
            approvedEpcs: {
              type: "array",
              description: "EPCs selected for dispatch (RR line charge status approved)",
              items: {
                type: "string",
                example: "E280689400001",
              },
            },
            remainingEpcs: {
              type: "array",
              description: "EPCs NOT selected — stay in transit (pending / hold / unknown)",
              items: {
                type: "string",
                example: "E280689400002",
              },
            },
            approvedLines: {
              type: "array",
              description:
                "Approved RR lines (carries IFS identifiers for RF-24 Transfer ID generation)",
              items: {
                $ref: "#/components/schemas/TransitExitApprovedLine",
              },
            },
            remainingLines: {
              type: "array",
              description: "RR lines excluded from the dispatch subset",
              items: {
                $ref: "#/components/schemas/TransitExitRemainingLine",
              },
            },
          },
        },
        // Transit Exit — Generate Transfer ID (RF-24) schemas
        TransitExitGenerateTransferRequest: {
          type: "object",
          required: ["epcs"],
          properties: {
            epcs: {
              type: "array",
              minItems: 1,
              description: "Approved EPC set from RF-23 select-approved",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 64,
                example: "E280689400001",
              },
            },
          },
        },
        TransitExitTransferEpcResult: {
          type: "object",
          properties: {
            epc: {
              type: "string",
              description: "EPC identifier",
              example: "E280689400001",
            },
            status: {
              type: "string",
              enum: ["VALID", "INVALID", "NOT_APPROVED", "HOLD", "UNKNOWN"],
              description: "Validation result for this EPC",
              example: "VALID",
            },
            rrLineId: {
              type: "string",
              nullable: true,
              description: "RR line identifier (null when UNKNOWN)",
              example: "123",
            },
            rrLineNo: {
              type: "string",
              nullable: true,
              description: "IFS line number (null when UNKNOWN)",
              example: "1",
            },
            rrNo: {
              type: "string",
              nullable: true,
              description: "IFS RR number (null when UNKNOWN)",
              example: "RR-2026-001",
            },
            reason: {
              type: "string",
              nullable: true,
              description: "Reason for non-VALID status",
              example: "RR line charge status is pending",
            },
          },
        },
        TransitExitGenerateTransferResponse: {
          type: "object",
          properties: {
            transferId: {
              type: "string",
              description: "Generated unique Transfer ID",
              example: "TID-20260821-0001",
            },
            epcs: {
              type: "array",
              description: "EPCs that were successfully transferred",
              items: {
                type: "string",
                example: "E280689400001",
              },
            },
            totalEpcs: {
              type: "integer",
              description: "Total number of EPCs transferred",
              example: 3,
            },
            epcResults: {
              type: "array",
              description: "Per-EPC validation results",
              items: {
                $ref: "#/components/schemas/TransitExitTransferEpcResult",
              },
            },
          },
        },
        // Transit Exit — Not-Approved Alert (RF-25) schemas
        TransitExitAlertRequest: {
          type: "object",
          required: ["reason", "epcs"],
          properties: {
            ref: {
              type: "string",
              nullable: true,
              maxLength: 120,
              description:
                "Optional transit-exit / transfer reference (e.g. transferId) for traceability",
              example: "TR-2026-000123",
            },
            reason: {
              type: "string",
              minLength: 1,
              maxLength: 1000,
              description: "Free-text reason the packet(s) were not approved",
              example: "Charge not approved by IFS — pending finance clearance",
            },
            epcs: {
              type: "array",
              minItems: 1,
              description: "EPCs that were NOT approved (the subject of the alert)",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 64,
                example: "E280689400002",
              },
            },
          },
        },
        TransitExitAlertRecipient: {
          type: "object",
          properties: {
            role: {
              type: "string",
              description: "Role name the recipient was resolved from",
              example: "transit_manager",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "Recipient user identifier",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            email: {
              type: "string",
              format: "email",
              description: "Recipient email address",
              example: "manager@example.com",
            },
            firstName: {
              type: "string",
              description: "Recipient first name",
              example: "Priya",
            },
            lastName: {
              type: "string",
              description: "Recipient last name",
              example: "Sharma",
            },
          },
        },
        TransitExitAlertResponse: {
          type: "object",
          properties: {
            alertId: {
              type: "string",
              description: "Identifier of the created alert record",
              example: "42",
            },
            alertType: {
              type: "string",
              description: "Alert type discriminator",
              example: "TRANSIT_EXIT_NOT_APPROVED",
            },
            severity: {
              type: "string",
              description: "Alert severity",
              example: "WARNING",
            },
            ref: {
              type: "string",
              nullable: true,
              description: "Reference captured with the alert (if any)",
              example: "TR-2026-000123",
            },
            message: {
              type: "string",
              description: "The free-text reason supplied by the operator",
              example: "Charge not approved by IFS — pending finance clearance",
            },
            status: {
              type: "string",
              description: "Alert status",
              example: "OPEN",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "When the alert was raised",
              example: "2026-01-01T10:00:00.000Z",
            },
            notifiedRoles: {
              type: "array",
              description: "Manager roles that were notified",
              items: {
                type: "string",
                example: "transit_manager",
              },
            },
            recipients: {
              type: "array",
              description: "Resolved recipient users (from the manager roles)",
              items: {
                $ref: "#/components/schemas/TransitExitAlertRecipient",
              },
            },
          },
        },
        // Transit Door (RF-26, RF-27, RF-28) schemas
        TransitDoorReadRequest: {
          type: "object",
          required: ["deviceId", "epcs"],
          properties: {
            deviceId: {
              type: "string",
              maxLength: 64,
              description: "Identifier of the transit door RFID reader device",
              example: "TRANSIT_DOOR_READER_01",
            },
            epcs: {
              type: "array",
              minItems: 1,
              description: "EPC set captured by the gate RFID reader at the transit door",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 64,
                example: "E2801191AABBCCDD",
              },
            },
          },
        },
        TransitDoorEpcResult: {
          type: "object",
          properties: {
            epc: {
              type: "string",
              description: "The EPC as received from the reader",
              example: "E2801191AABBCCDD",
            },
            hasTid: {
              type: "boolean",
              description: "Whether a TID was found in Redis (tid:{epc})",
              example: true,
            },
            status: {
              type: "string",
              enum: ["AUTHORIZED", "UNAUTHORIZED", "EXEMPT"],
              description:
                "AUTHORIZED — EPC is associated with an active transfer (DB-verified; tid:{epc} is only the lineage fast-path). EXEMPT — barcode-only tag (no RFID inlay) is allowed through without a TID. UNAUTHORIZED — no active transfer (CRITICAL alert + event log created).",
              example: "AUTHORIZED",
            },
            reason: {
              type: "string",
              description: "Why the EPC was EXEMPT (e.g. barcode-only tag); absent otherwise",
              example: "barcode-only tag",
            },
          },
        },
        TransitDoorReadResponse: {
          type: "object",
          properties: {
            totalTags: {
              type: "integer",
              description: "Total EPCs received from the reader (before de-duplication)",
              example: 3,
            },
            authorized: {
              type: "integer",
              description: "Number of EPCs with TID in Redis (AUTHORIZED)",
              example: 2,
            },
            unauthorized: {
              type: "integer",
              description: "Number of RFID-enabled EPCs without TID in Redis (UNAUTHORIZED)",
              example: 1,
            },
            exempt: {
              type: "integer",
              description: "Number of barcode-only EPCs exempted from the TID check (EXEMPT)",
              example: 0,
            },
            results: {
              type: "array",
              description: "Per-EPC read result in first-seen de-duplicated order",
              items: {
                $ref: "#/components/schemas/TransitDoorEpcResult",
              },
            },
          },
        },
        // Audit schemas
        AuditAction: {
          type: "object",
          properties: {
            code: { type: "string", example: "TAG_GENERATE" },
            label: { type: "string", example: "Generate RFID Tag" },
          },
        },
        AuditPerformedBy: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", nullable: true },
            name: { type: "string", nullable: true, example: "Rahul Sharma" },
            role: { type: "string", nullable: true, example: "admin" },
          },
        },
        AuditScreen: {
          type: "object",
          properties: {
            code: { type: "string", example: "TAGGING" },
            label: { type: "string", example: "Tagging" },
          },
        },
        AuditResourceInfo: {
          type: "object",
          properties: {
            type: { type: "string", example: "PacketTag" },
            label: { type: "string", example: "Packet Tag" },
            id: { type: "string", nullable: true, example: "550" },
          },
        },
        AuditResult: {
          type: "object",
          properties: {
            code: { type: "string", example: "SUCCESS" },
            label: { type: "string", example: "Success" },
          },
        },
        AuditLogEntry: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique audit record identifier",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            action: { $ref: "#/components/schemas/AuditAction" },
            description: {
              type: "string",
              description: "Human-readable summary of what happened",
              example: "RFID tag 3034362CFB2B4F0000000000 was generated.",
            },
            performedBy: { $ref: "#/components/schemas/AuditPerformedBy" },
            screen: { $ref: "#/components/schemas/AuditScreen" },
            resource: { $ref: "#/components/schemas/AuditResourceInfo" },
            result: { $ref: "#/components/schemas/AuditResult" },
            ip: { type: "string", nullable: true, example: "192.168.1.20" },
            userAgent: { type: "string", nullable: true, example: "Mozilla/5.0" },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "When the action occurred",
              example: "2026-09-16T16:30:12.000Z",
            },
          },
        },
        AuditLogListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLogEntry" },
            },
            pagination: { $ref: "#/components/schemas/Pagination" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              example: 1,
            },
            limit: {
              type: "integer",
              example: 20,
            },
            total: {
              type: "integer",
              example: 42,
            },
            totalPages: {
              type: "integer",
              example: 3,
            },
          },
        },
        Transfer: {
          type: "object",
          properties: {
            transferId: { type: "string", example: "TRF-LATEST-BIN-001" },
          },
        },
        TransfersResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Transfers retrieved successfully" },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Transfer" },
            },
          },
        },
        TagDetails: {
          type: "object",
          properties: {
            tagId: { type: "string", example: "1" },
            epc: { type: "string", example: "E200234342344" },
            tagType: { type: "string", example: "RFID" },
            packetNo: { type: "integer", example: 1 },
            status: { type: "string", example: "COMMISSIONED" },
            serialNumber: { type: "string", nullable: true, example: "SN-001" },
            barcode: { type: "string", nullable: true, example: "BC-001" },
            qty: { type: "string", example: "100" },
            isVoided: { type: "boolean", example: false },
            itemId: { type: "string", example: "1" },
            itemCode: { type: "string", example: "ITEM-001" },
            itemDescription: { type: "string", nullable: true, example: "Item 1" },
            acceptedQty: { type: "string", nullable: true, example: "500" },
            receivedQty: { type: "string", nullable: true, example: "500" },
            orderedQty: { type: "string", nullable: true, example: "500" },
            ownership: { type: "string", nullable: true, example: "HAL" },
          },
        },
        TagDetailsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Tag details retrieved successfully" },
            data: { $ref: "#/components/schemas/TagDetails" },
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Bad Request - Validation failed",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                error: {
                  code: "VALIDATION_ERROR",
                  message: "Validation failed",
                  details: [
                    { field: "email", message: "Invalid email format" },
                    { field: "password", message: "Password must be at least 8 characters" },
                  ],
                },
                requestId: "req-abc123",
              },
            },
          },
        },
        Unauthorized: {
          description: "Unauthorized - Invalid or missing credentials",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                error: {
                  code: "UNAUTHORIZED",
                  message: "Invalid credentials",
                },
                requestId: "req-abc123",
              },
            },
          },
        },
        Forbidden: {
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                error: {
                  code: "FORBIDDEN",
                  message: "You do not have permission to perform this action",
                },
                requestId: "req-abc123",
              },
            },
          },
        },
        NotFound: {
          description: "Not Found - Resource does not exist",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                error: {
                  code: "NOT_FOUND",
                  message: "Resource not found",
                },
                requestId: "req-abc123",
              },
            },
          },
        },
        Conflict: {
          description: "Conflict - Resource already exists",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                error: {
                  code: "CONFLICT",
                  message: "Email already registered",
                },
                requestId: "req-abc123",
              },
            },
          },
        },
        InternalServerError: {
          description: "Internal Server Error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                error: {
                  code: "INTERNAL_ERROR",
                  message: "Something went wrong",
                },
                requestId: "req-abc123",
              },
            },
          },
        },
        ServiceUnavailable: {
          description: "Service Unavailable",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                error: {
                  code: "SERVICE_UNAVAILABLE",
                  message: "Service temporarily unavailable",
                },
                requestId: "req-abc123",
              },
            },
          },
        },
        TooManyRequests: {
          description: "Too Many Requests - Rate limit exceeded",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              example: {
                success: false,
                error: {
                  code: "RATE_LIMITED",
                  message: "Too many requests, please try again later",
                },
                requestId: "req-abc123",
              },
            },
          },
        },
      },
    },
    security: [],
    tags: [
      {
        name: "Authentication",
        description: "User authentication and registration endpoints",
      },
      {
        name: "Health",
        description: "Health check endpoints for monitoring",
      },
      {
        name: "Users",
        description: "User account and profile management endpoints",
      },
      {
        name: "RBAC",
        description: "Role and permission management endpoints (CRUD for roles and permissions)",
      },
      {
        name: "Audit",
        description: "Audit log query endpoints",
      },
      {
        name: "Transit",
        description: "Transit Exit module (Phase 3) — bulk EPC read at the transit exit",
      },
      {
        name: "TransitExit",
        description:
          "Transit Exit — Charge Approval (RF-22), Select Approved Subset (RF-23) and Not-Approved Alert (RF-25) modules (Phase 3) — IFS charge-approval check, dispatch-subset selection and manager alerting for EPCs read at the transit exit",
      },
      {
        name: "Binning",
        description: "Binning plan management and bin/position assignment operations (RF-37+)",
      },
      {
        name: "Master Data",
        description: "Cached IFS master data for approved alternates and bin-position mappings",
      },
      {
        name: "Asset Transfer & Storage",
        description:
          "Asset transfer tracking, storage locations, and tag lookups (public, no auth required). The four bin/storage APIs — transfers, storage locations, location items, and tag details.",
      },
    ],
  },
  apis: [
    "./src/routes/*.ts",
    "./src/controllers/*.ts",
    "./src/routes/rr.routes.ts",
    "./src/routes/tags.routes.ts",
    "./src/routes/transit.routes.ts",
    "./src/routes/transit-exit.routes.ts",
    "./src/routes/binning.routes.ts",
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
