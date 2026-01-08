// // old
// import mongoose from "mongoose";
// const { Schema } = mongoose;

// // Item inside a vendor's order
// const OrderItemSchema = new Schema(
//   {
//     productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
//     quantity: { type: Number, default: 1 },
//     price: { type: Number, required: true },
//     totalPrice: { type: Number, required: true },
//   },
//   { _id: false }
// );

// // Each vendor block
// const OrderVendorSchema = new Schema(
//   {
//     vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
//     driverId: {
//       type: Schema.Types.ObjectId,
//       ref: "DriverDetail",
//       default: null,
//     },

//     pickupLatitude: { type: Number, default: 0 },
//     pickupLongitude: { type: Number, default: 0 },
//     pickupStreet: { type: String, default: null },
//     pickupCity: { type: String, default: null },
//     pickupState: { type: String, default: null },
//     pickupCountry: { type: String, default: null },

//     status: {
//       type: String,
//       enum: [
//         "pending",
//         "confirmed",
//         "Ready",
//         "driver-accepted",
//         "picked",
//         "delivered",
//         "cancelled",
//         "returned",
//       ],
//       default: "pending",
//     },

//     paymentStatus: {
//       type: String,
//       enum: ["unpaid", "paid", "refunded"],
//       default: "unpaid",
//     },

//     rejectedDrivers: [
//       {
//         driverId: { type: Schema.Types.ObjectId, ref: "DriverDetail" },
//         reason: { type: String, default: null },
//       },
//     ],

//     items: [OrderItemSchema],
//   },
//   { _id: false }
// );

// const OrderSchema = new Schema(
//   {
//     orderNumber: { type: String, required: true, unique: true },
//     customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },

//     dropLatitude: { type: Number, default: 0 },
//     dropLongitude: { type: Number, default: 0 },
//     dropStreet: { type: String, default: null },
//     dropCity: { type: String, default: null },
//     dropState: { type: String, default: null },
//     dropCountry: { type: String, default: null },

//     phone: { type: String },
//     notes: { type: String },

//     totalItems: { type: Number, default: 0 },
//     subTotal: { type: Number, default: 0.0 },
//     shippingFee: { type: Number, default: 0.0 },
//     grandTotal: { type: Number, default: 0.0 },

//     paymentMethod: {
//       type: String,
//       enum: ["cash", "card", "wallet"],
//       default: "cash",
//     },
//     type: { type: String, enum: ["1", "2"], required: true },

//     vendors: [OrderVendorSchema],

//     // return request
//     returnRequest: {
//       isRequested: { type: Boolean, default: false },
//       expectedPickupDate: { type: Date },
//       status: {
//         type: String,
//         enum: [
//           "requested",
//           "driver-assigned",
//           "Ready",
//           "picked",
//           "vendor-received",
//           "completed",
//           // "rejected"
//         ],
//         default: null,
//       },
//       driverId: {
//         type: Schema.Types.ObjectId,
//         ref: "DriverDetail",
//         default: null,
//       },
//       reason: { type: String, default: null },
//     },
//   },
//   { collection: "orders", timestamps: true }
// );

// export default mongoose.model("Order", OrderSchema);
//new
import mongoose from "mongoose";
const { Schema } = mongoose;
/* ----------------------------
   Item inside a vendor's order
---------------------------- */
const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, default: 1 },
    price: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

/* ----------------------------
   Each vendor block
---------------------------- */
const OrderVendorSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    pickupLatitude: { type: Number, default: 0 },
    pickupLongitude: { type: Number, default: 0 },
    pickupStreet: { type: String, default: null },
    pickupCity: { type: String, default: null },
    pickupState: { type: String, default: null },
    pickupCountry: { type: String, default: null },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "ready",
        "driver-accepted",
        "picked",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },

    items: [OrderItemSchema],
  },
  { _id: false }
);

/* ----------------------------
   Multi-leg shipment support
---------------------------- */
const LegSchema = new Schema(
  {
    sequence: { type: Number, required: true }, // order of the leg (1,2,3,...)

    from: {
      latitude: Number,
      longitude: Number,
      street: String,
      city: String,
      state: String,
      country: String,
    },
    to: {
      latitude: Number,
      longitude: Number,
      street: String,
      city: String,
      state: String,
      country: String,
    },
    rejectedDrivers: [
      {
        driverId: { type: Schema.Types.ObjectId, ref: "DriverDetail" },
        reason: { type: String, default: null },
      },
    ],
    driverId: { type: Schema.Types.ObjectId, ref: "DriverDetail" },
    vehicleType: {
      type: String,
      enum: ["bike", "van"],
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending", // leg not started
        "driver-assigned",
        "picked",
        "in-transit",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    cost: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false }
);

/* ----------------------------
   Main Order Schema
---------------------------- */
const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // final drop address (for short deliveries)
    dropLatitude: { type: Number, default: 0 },
    dropLongitude: { type: Number, default: 0 },
    dropStreet: { type: String, default: null },
    dropCity: { type: String, default: null },
    dropState: { type: String, default: null },
    dropCountry: { type: String, default: null },

    phone: { type: String },
    notes: { type: String },

    totalItems: { type: Number, default: 0 },
    subTotal: { type: Number, default: 0.0 },
    shippingFee: { type: Number, default: 0.0 },
    grandTotal: { type: Number, default: 0.0 },

    paymentMethod: {
      type: String,
      enum: ["cash", "card", "wallet"],
      default: "cash",
    },
    type: { type: String, enum: ["1", "2"], required: true },

    vendors: [OrderVendorSchema], // keep vendor-level blocks

    /* ------------------------
       Multi-leg delivery flow
    ------------------------ */
    legs: [LegSchema], // one or more legs (supports multiple drivers)
    drivers: [{ type: Schema.Types.ObjectId, ref: "DriverDetail" }], // quick ref to all drivers

    // return request
    returnRequest: {
      isRequested: { type: Boolean, default: false },
      expectedPickupDate: { type: Date },
      status: {
        type: String,
        enum: [
          "requested",
          "driver-assigned",
          "ready",
          "picked",
          "vendor-received",
          "completed",
          "rejected"
        ],
        default: null,
      },
      driverId: {
        type: Schema.Types.ObjectId,
        ref: "DriverDetail",
        default: null,
      },
      reason: { type: String, default: null },
    },
  },
  { collection: "orders", timestamps: true }
);
/* ----------------------------
   Instance Methods
---------------------------- */
OrderSchema.methods.updateGlobalStatus = function () {
  const legs = this.legs || [];

  if (!legs.length) {
    // fallback for short orders without legs
    return;
  }

  if (legs.every((l) => l.status === "delivered")) {
    this.status = "delivered";
  } else if (
    legs.some((l) => l.status === "delivered") &&
    legs.some((l) => l.status !== "delivered")
  ) {
    this.status = "partially-delivered";
  } else if (legs.some((l) => ["picked", "in-transit"].includes(l.status))) {
    this.status = "in-progress";
  } else if (legs.every((l) => l.status === "pending")) {
    this.status = "pending";
  } else if (legs.some((l) => l.status === "cancelled")) {
    this.status = "cancelled";
  }
};

/* ----------------------------
   Middleware: Auto-update status
---------------------------- */
OrderSchema.pre("save", function (next) {
  this.updateGlobalStatus();
  next();
});

export default mongoose.model("Order", OrderSchema);
