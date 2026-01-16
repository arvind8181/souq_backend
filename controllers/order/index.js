import axios from "axios";
import mongoose from "mongoose";
import JsonRes from "../../helpers/response.js";
import Product from "../../models/product/products.js";
import Order from "../../models/order/order.js";
import Category from "../../models/category/category.js";
import Cart from "../../models/cart/cart.js";
import Address from "../../models/address/address.js";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import DriverDetail from "../../models/driverDetails/driverDetails.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import DriverCommission from "../../models/driverCommission/driverCommission.js";
import { sendNotification } from "../../services/notificationService.js";
import { getPresignedImageUrls } from "../../services/s3Service.js";
import jwt from "jsonwebtoken";

const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  unauthorized,
  notFound,
} = JsonRes;

//  Create order
export const createOrder = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { paymentMethod, notes, type } = req.body;

    // 🔹 Load cart
    const cart = await Cart.findOne({ userId: customerId }).lean();
    if (!cart || cart.items.length === 0) {
      return badRequest(res, null, "Your cart is empty.");
    }

    // 🔹 Filter items by product rules
    const filteredItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.productId).lean();
      if (!product) {
        return notFound(
          res,
          null,
          `Product with ID ${item.productId} not found.`
        );
      }
      if (product.productType !== type) continue;
      if (paymentMethod === "cash" && !product.isCODAvailable) {
        return badRequest(
          res,
          null,
          `Cash on delivery not allowed for ${product.productName}.`
        );
      }
      if (product.stockQuantity < item.quantity) {
        return badRequest(
          res,
          null,
          `Only ${product.stockQuantity} item(s) left for ${product.productName}.`
        );
      }
      filteredItems.push(item);
    }

    if (filteredItems.length === 0) {
      return badRequest(
        res,
        null,
        `No products found in your cart for type: ${type}.`
      );
    }

    // 🔹 Totals
    const totalItems = filteredItems.reduce((sum, i) => sum + i.quantity, 0);
    const subTotal = filteredItems.reduce(
      (sum, i) => sum + (i.totalPrice || 0),
      0
    );

    // 🔹 Group by vendor
    const vendorMap = new Map();
    for (const item of filteredItems) {
      if (!vendorMap.has(item.vendorId.toString())) {
        vendorMap.set(item.vendorId.toString(), []);
      }
      vendorMap.get(item.vendorId.toString()).push(item);
    }

    const uniqueVendors = vendorMap.size;
    const shippingFee = uniqueVendors > 1 ? 2 : 1;
    const grandTotal = subTotal + shippingFee;

    // 🔹 Customer address
    const customer = await Address.findOne({
      userId: customerId,
      isDefault: true,
    }).lean();
    if (!customer) return notFound(res, null, "Default address not found.");

    const paymentStatus = ["card", "wallet"].includes(paymentMethod)
      ? "paid"
      : "unpaid";

    // 🔹 Build vendors array
    const vendors = await Promise.all(
      Array.from(vendorMap.entries()).map(async ([vendorId, items]) => {
        const vendor = await VendorDetail.findOne({ userId: vendorId }).lean();
        const location = vendor?.location?.coordinates || [0, 0];
        const address = vendor?.address || {};

        return {
          vendorId,

          pickupLatitude: location[1],
          pickupLongitude: location[0],
          pickupStreet: address.street || null,
          pickupCity: address.city || null,
          pickupState: address.state || null,
          pickupCountry: address.country || null,
          status: "pending",
          paymentStatus,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice,
          })),
        };
      })
    );

    /* -----------------------
       🔹 Build legs by type
    ----------------------- */
    let legs = [];

    if (type === "1") {
      // Each vendor delivers directly to customer
      vendors.forEach((v, idx) => {
        legs.push({
          sequence: idx + 1,
          from: {
            latitude: v.pickupLatitude,
            longitude: v.pickupLongitude,
            street: v.pickupStreet,
            city: v.pickupCity,
            state: v.pickupState,
            country: v.pickupCountry,
          },
          to: {
            latitude: customer.coordinates.latitude,
            longitude: customer.coordinates.longitude,
            street: `${customer.buildingNo}, Apt ${
              customer.apartmentNo
            }, Floor ${customer.floorNo}, ${customer.street || ""}, ${
              customer.landmark || ""
            }`.trim(),
            city: customer.city,
            state: customer.state,
            country: customer.country || "",
          },
          rejectedDrivers: [],
          driverId: null,
          vehicleType: null,
          status: "pending",
        });
      });
    } else if (type === "2") {
      // Multi-leg with warehouses
      // const warehouseA = await Warehouse.findOne({ code: "A" }).lean();
      // const warehouseB = await Warehouse.findOne({ code: "B" }).lean();
      const warehouseA = {
        code: "A",
        city: "Damascus",
        location: { lat: 33.5138, lng: 36.2765 }, // example coordinates
      };
      const warehouseB = {
        code: "B",
        city: "Aleppo",
        location: { lat: 36.2021, lng: 37.1343 }, // example coordinates
      };
      if (!warehouseA || !warehouseB) {
        return serverError(res, null, "Warehouse configuration missing.");
      }

      // Step 1: Each vendor → WH A
      vendors.forEach((v, idx) => {
        legs.push({
          sequence: idx + 1,
          from: {
            latitude: v.pickupLatitude,
            longitude: v.pickupLongitude,
            city: v.pickupCity,
          },
          to: {
            latitude: warehouseA.location.lat,
            longitude: warehouseA.location.lng,
            city: warehouseA.city,
          },
          rejectedDrivers: [],
          driverId: null,
          status: "pending",
        });
      });

      // Step 2: WH A → WH B
      legs.push({
        sequence: vendors.length + 1,
        from: {
          latitude: warehouseA.location.lat,
          longitude: warehouseA.location.lng,
          city: warehouseA.city,
        },
        to: {
          latitude: warehouseB.location.lat,
          longitude: warehouseB.location.lng,
          city: warehouseB.city,
        },
        driverId: null,
        status: "pending",
      });

      // Step 3: WH B → Customer
      legs.push({
        sequence: vendors.length + 2,
        from: {
          latitude: warehouseB.location.lat,
          longitude: warehouseB.location.lng,
          city: warehouseB.city,
        },
        to: {
          latitude: customer.coordinates.latitude,
          longitude: customer.coordinates.longitude,
          city: customer.city,
        },
        driverId: null,
        status: "pending",
      });
    }

    // 🔹 Collect drivers (none assigned yet)
    const drivers = legs.map((l) => l.driverId).filter(Boolean);

    // 🔹 Final payload
    const orderPayload = {
      orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`,
      type,
      customerId,
      paymentMethod,
      notes: notes || null,
      totalItems,
      subTotal,
      shippingFee,
      grandTotal,
      dropLatitude: customer.coordinates.latitude,
      dropLongitude: customer.coordinates.longitude,
      dropStreet: `${customer.buildingNo}, Apt ${customer.apartmentNo}, Floor ${
        customer.floorNo
      }, ${customer.street || ""}, ${customer.landmark || ""}`.trim(),
      dropCity: customer.city,
      dropState: customer.state,
      dropCountry: customer.country || "",
      vendors,
      legs,
      drivers,
    };

    const order = new Order(orderPayload);
    await order.save();

    // 🔹 Decrease stock
    for (const item of filteredItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stockQuantity: -item.quantity },
      });
    }

    // 🔹 Clean cart
    if (filteredItems.length === cart.items.length) {
      await Cart.findOneAndDelete({ userId: customerId });
    } else {
      await Cart.updateOne(
        { userId: customerId },
        {
          $pull: {
            items: {
              productId: { $in: filteredItems.map((i) => i.productId) },
            },
          },
        }
      );
    }

    return success(res, order, "Order placed successfully.");
  } catch (err) {
    console.error("Order creation error:", err);
    return serverError(res, err, "Failed to create order.");
  }
};
//new
export const getActiveOrders = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      sortKey = "createdAt",
      sortDirection = "desc",
      search = "",
      type = 0,
      excludedStatuses = ["delivered", "cancelled", "returned"], // vendor-level status filter
    } = req.body;

    const skip = (page - 1) * pageSize;
    const sortOpt = { [sortKey]: sortDirection === "asc" ? 1 : -1 };

    /* --------------------------
       Base filter (vendor-level)
    -------------------------- */
    let filter = {
      "vendors.status": { $nin: excludedStatuses },
    };

    if (Number(type) !== 0) {
      filter.type = String(type); // schema stores type as string ("1" | "2")
    }

    /* --------------------------
       Query
    -------------------------- */
    const orders = await Order.find(filter)
      .sort(sortOpt)
      .skip(skip)
      .limit(pageSize)
      .populate("customerId", "name email")
      .populate("vendors.vendorId", "name email")
      .populate(
        "vendors.items.productId",
        "productName price discountedprice images"
      )
      .lean();

    /* --------------------------
       Expand orders per vendor
    -------------------------- */
    let expandedOrders = [];
    for (const order of orders) {
      if (Array.isArray(order.vendors)) {
        for (const vendor of order.vendors) {
          if (!excludedStatuses.includes(vendor.status)) {
            expandedOrders.push({
              ...order,
              vendor: vendor.vendorId,
              vendorStatus: vendor.status,
              paymentStatus: vendor.paymentStatus,
              driverId: vendor.driverId,
              items: vendor.items,
              Status: vendor.status,
              pickupStreet: vendor.pickupStreet,
              pickupCity: vendor.pickupCity,
              pickupState: vendor.pickupState,
              pickupCountry: vendor.pickupCountry,
            });
          }
        }
      }
    }

    /* --------------------------
       Apply search
    -------------------------- */
    let filteredOrders = expandedOrders;
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filteredOrders = expandedOrders.filter((o) => {
        return (
          regex.test(o.orderNumber) ||
          regex.test(o.customerId?.name || "") ||
          regex.test(o.customerId?.email || "") ||
          regex.test(o.vendor?.email || "") ||
          o.items?.some((i) => regex.test(i.productId?.productName || ""))
        );
      });
    }

    return success(
      res,
      {
        data: filteredOrders,
        totalRecords: filteredOrders.length,
        currentPage: page,
        pageSize,
      },
      "Active vendor-level orders retrieved successfully."
    );
  } catch (err) {
    console.error("Error retrieving active orders:", err);
    return serverError(res, err, "Failed to retrieve active orders.");
  }
};

//  Update order status
export const updateStatus = async (req, res) => {
  try {
    const {
      orderId,
      status,
      vendorId,
      vehicleType = "bike",
      sequence = 1, // 🔹 Default sequence
    } = req.body;

    if (!orderId || !status || !vendorId) {
      return badRequest(
        res,
        null,
        "orderId, vendorId, and status are required."
      );
    }

    const allowedStatuses = [
      "pending",
      "confirmed",
      "ready",
      "driver-accepted",
      "picked",
      "delivered",
      "cancelled",
      "returned",
    ];
    if (!allowedStatuses.includes(status)) {
      return badRequest(res, null, "Invalid status value.");
    }

    const order = await Order.findById(orderId);
    if (!order) return notFound(res, null, "Order not found.");
    const customerDetail = await CustomerDetail.findOne({
      userId: order.customerId,
    });

    // ✅ Find vendor block
    const vendorBlock = order.vendors.find(
      (v) => v.vendorId.toString() === vendorId.toString()
    );
    if (!vendorBlock)
      return notFound(res, null, "Vendor not found in this order.");

    if (vendorBlock.status === status) {
      return badRequest(res, null, `Order is already marked as ${status}.`);
    }

    /* -------------------------------
       Special handling for CONFIRMED
    -------------------------------- */
    if (status === "confirmed") {
      const pickupCoords = [
        vendorBlock.pickupLongitude,
        vendorBlock.pickupLatitude,
      ];

      const query = {
        isAvailable: true,
        isDelivering: false,
        status: "Approved",
        vehicleType: vehicleType, // 🔹 Only drivers of this type
        location: {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: pickupCoords },
            // $maxDistance: 1000000, // ~10km
            $maxDistance: 100000000, // ~10km
          },
        },
      };

      const driver = await DriverDetail.findOne(query);

      if (!driver) {
        return badRequest(
          res,
          null,
          `No available ${vehicleType} drivers nearby. Cannot confirm order.`
        );
      }

      // ✅ Find the correct leg by sequence
      const leg = order.legs.find(
        (l) => l.sequence === Number(sequence) && !l.driverId
      );

      if (!leg) {
        return badRequest(res, null, `No leg found with sequence ${sequence}.`);
      }

      // Assign driver to this leg
      leg.driverId = driver._id;
      leg.vehicleType = vehicleType;
      leg.status = "driver-assigned";

      // Update driver status
      driver.isAvailable = false;
      driver.isDelivering = true;
      await driver.save();

      // Push driver into quick ref list
      if (!order.drivers.includes(driver._id)) {
        order.drivers.push(driver._id);
      }

      vendorBlock.status = "confirmed";
      await order.save();

      return success(
        res,
        driver,
        "Driver assigned to leg and order confirmed successfully."
      );
    }

    /* -------------------------------
       Handle DELIVERED
    -------------------------------- */
    if (status === "delivered") {
      vendorBlock.paymentStatus = "paid";

      // ✅ Free driver for the specific leg (sequence-based)
      const leg = order.legs.find(
        (l) => l.sequence === Number(sequence) && l.driverId
      );

      if (leg) {
        await DriverDetail.findByIdAndUpdate(leg.driverId, {
          isAvailable: true,
          isDelivering: false,
        });
        leg.status = "delivered";
        leg.completedAt = new Date();
      }
    }

    /* -------------------------------
       Other statuses
    -------------------------------- */
    vendorBlock.status = status;
    await order.save();

    // Dynamic message
    let message;
    switch (status) {
      case "driver-accepted":
        message = "Driver order accepted successfully.";
        break;
      case "picked":
        message = "Order picked up successfully.";
        break;
      case "delivered":
        message = "Order delivered successfully & payment marked as paid.";
        break;
      default:
        message = "Order status updated successfully.";
    }

    // ---- Push Notifications to Customer ----
    if (customerDetail) {
      let notificationBody = "";
      if (status === "driver-accepted") {
        notificationBody =
          "Your driver has accepted the order. They are on the way!";
      } else if (status === "picked") {
        notificationBody =
          "Your order has been picked up and is en route to you!";
      } else if (status === "delivered") {
        notificationBody = "Your order has been delivered successfully. Enjoy!";
      }

      await sendNotification({
        entityId: customerDetail._id,
        title: "Order Update",
        body: notificationBody,
        data: { orderId: order._id, status },
      });
    }

    return success(res, order, message);
  } catch (err) {
    console.error("Error updating order status:", err);
    return serverError(res, err, "Failed to update order status.");
  }
};

//  Get vendor orders
export const getVendorOrders = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      sortKey = "createdAt",
      sortDirection = "desc",
      search = "",
      status = "",
      type = "",
    } = req.body;

    const vendorId = req.user.id; // logged-in vendor
    const skip = (page - 1) * pageSize;
    const sortOpt = { [sortKey]: sortDirection === "asc" ? 1 : -1 };

    // --- Base filter ---
    let filter = {
      vendors: {
        $elemMatch: {
          vendorId: vendorId,
          ...(status
            ? {
                status: Array.isArray(status)
                  ? { $in: status }
                  : typeof status === "string" && status.includes(",")
                  ? { $in: status.split(",").map((s) => s.trim()) }
                  : status,
              }
            : {}),
        },
      },
    };

    if (type) filter.type = String(type);

    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ orderNumber: regex }];
    }

    const totalRecords = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .sort(sortOpt)
      .skip(skip)
      .limit(pageSize)
      .populate("customerId", "name email")
      .populate("vendors.vendorId", "name email")
      .populate(
        "legs.driverId",
        "FullName mobileNumber vehicleType profileImage status isAvailable isDelivering"
      ) // ✅ fixed: use legs.driverId instead of vendors.driverId
      .populate("vendors.items.productId", "productName images price")
      .lean();

    let vendorOrders = [];

    for (const order of orders) {
      const vendorBlock = order.vendors.find(
        (v) => v.vendorId?._id?.toString() === vendorId.toString()
      );

      if (!vendorBlock) continue;

      // --- Find legs linked to this vendor ---
      // For simple (15_min) orders → leg.from matches vendor pickup
      // For marketplace, vendor only relates to first leg
      const vendorLegs = order.legs
        ? order.legs.filter(
            (l) =>
              l.from?.city === vendorBlock.pickupCity ||
              l.from?.street === vendorBlock.pickupStreet
          )
        : [];

      // --- Map drivers from those legs ---
      const drivers = [];
      for (const leg of vendorLegs) {
        if (leg.driverId) {
          // presigned URL for profile image
          const urls = await getPresignedImageUrls([leg.driverId.profileImage]);
          drivers.push({
            id: leg.driverId._id,
            fullName: leg.driverId.FullName,
            mobileNumber: leg.driverId.mobileNumber,
            profileImage: urls[0] || null,
            status: leg.driverId.status,
            isAvailable: leg.driverId.isAvailable,
            isDelivering: leg.driverId.isDelivering,
            vehicleType: leg.driverId.vehicleType,
          });
        }
      }

      const data = {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customer: order.customerId,
        dropStreet: order.dropStreet,
        dropCity: order.dropCity,
        dropState: order.dropState,
        dropCountry: order.dropCountry,
        phone: order.phone,
        notes: order.notes,
        totalItems: order.totalItems,
        subTotal: order.subTotal,
        shippingFee: order.shippingFee,
        grandTotal: order.grandTotal,
        paymentMethod: order.paymentMethod,
        type: order.type,
        createdAt: order.createdAt,

        // --- Vendor-specific fields ---
        vendor: vendorBlock.vendorId,
        status: vendorBlock.status,
        items: vendorBlock.items,
        paymentStatus: vendorBlock.paymentStatus,
        pickupStreet: vendorBlock.pickupStreet,
        pickupCity: vendorBlock.pickupCity,
        pickupState: vendorBlock.pickupState,
        pickupCountry: vendorBlock.pickupCountry,

        // --- Drivers assigned to vendor's legs ---
        drivers,

        // --- Vendor legs info ---
        legs: await Promise.all(
          vendorLegs.map(async (l) => {
            let driver = null;
            if (l.driverId) {
              const urls = await getPresignedImageUrls([
                l.driverId.profileImage,
              ]);
              driver = {
                id: l.driverId._id,
                fullName: l.driverId.FullName,
                mobileNumber: l.driverId.mobileNumber,
                profileImage: urls[0] || null,
                status: l.driverId.status,
                isAvailable: l.driverId.isAvailable,
                isDelivering: l.driverId.isDelivering,
                vehicleType: l.driverId.vehicleType,
              };
            }
            return {
              sequence: l.sequence,
              from: l.from,
              to: l.to,
              status: l.status,
              vehicleType: l.vehicleType,
              cost: l.cost,
              startedAt: l.startedAt,
              completedAt: l.completedAt,
              driver,
            };
          })
        ),
      };

      const dataToken = jwt.sign(
        { orderId: order._id, orderNumber: order.orderNumber },
        process.env.JWT_SECRET
      );

      vendorOrders.push({ ...data, dataToken });
    }

    return success(
      res,
      { data: vendorOrders, totalRecords, currentPage: page, pageSize },
      "Vendor orders retrieved successfully."
    );
  } catch (err) {
    console.error("Error retrieving vendor orders:", err);
    return serverError(res, err, "Failed to retrieve vendor orders.");
  }
};

// reassign Driver
export const reassignDriver = async (req, res) => {
  try {
    const { orderId, vendorId, reason, sequence = 1 } = req.body;

    if (!orderId || !vendorId) {
      return badRequest(res, null, "orderId and vendorId are required.");
    }

    const order = await Order.findById(orderId);
    if (!order) return notFound(res, null, "Order not found.");

    // ✅ Find the correct vendor block
    const vendorBlock = order.vendors.find(
      (v) => v.vendorId.toString() === vendorId.toString()
    );
    if (!vendorBlock) {
      return notFound(res, null, "Vendor not found in this order.");
    }

    // ✅ Find the leg by sequence only
    const leg = order.legs.find((l) => l.sequence === sequence);

    if (!leg) {
      return notFound(res, null, `Leg with sequence ${sequence} not found.`);
    }

    // --- Save previous driver in rejectedDrivers for that leg ---
    if (leg.driverId) {
      leg.rejectedDrivers.push({
        driverId: leg.driverId,
        reason: reason || null,
      });

      await DriverDetail.findByIdAndUpdate(leg.driverId, {
        isAvailable: true,
      });
    }

    const pickupCoords = [
      vendorBlock.pickupLongitude,
      vendorBlock.pickupLatitude,
    ];
    const rejectedIds = leg.rejectedDrivers.map((r) => r.driverId);

    // ✅ Find new driver within 10km excluding rejected ones
    const driver = await DriverDetail.findOne({
      isAvailable: true,
      isDelivering: true,
      status: "Approved",
      _id: { $nin: rejectedIds },
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: pickupCoords },
          $maxDistance: 10000, // 10 km
        },
      },
    });

    if (!driver) {
      leg.driverId = null;
      vendorBlock.status = "pending";
      await order.save();
      return success(res, { success: false }, "No other drivers available.");
    }

    // ✅ Assign new driver to this leg
    driver.isAvailable = false;
    await driver.save();

    leg.driverId = driver._id;
    vendorBlock.driverId = driver._id; // update vendor block as well
    vendorBlock.status = "confirmed";

    await order.save();

    return success(
      res,
      { success: true, driver },
      "Driver reassigned successfully."
    );
  } catch (err) {
    console.error("Reassign driver error:", err);
    return serverError(res, err, "Failed to reassign driver.");
  }
};

// getOrderDeliveryInformation
export const getOrderDeliveryInforInDriverSide = async (req, res) => {
  try {
    const { driverId } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey)
      return serverError(res, null, "Google Maps API Key is missing.");
    if (!driverId) return badRequest(res, null, "driverId is required.");

    const driverObjectId = new mongoose.Types.ObjectId(driverId);

    // ✅ Query orders where driver is assigned in legs
    const orders = await Order.find({ "legs.driverId": driverObjectId })
      .select(
        "_id orderNumber customerId status totalItems subTotal shippingFee grandTotal paymentMethod paymentStatus vendors dropLatitude dropLongitude dropStreet dropCity dropState dropCountry legs"
      )
      .lean();

    const orderData = await Promise.all(
      orders.map(async (order) => {
        const customer = await CustomerDetail.findOne(
          { userId: order.customerId },
          { FullName: 1, profileImage: 1 }
        ).lean();

        // Convert customer profile image to presigned URL
        let customerProfileUrl = null;
        if (customer?.profileImage) {
          const urls = await getPresignedImageUrls([customer.profileImage]);
          customerProfileUrl = urls[0] || null;
        }

        const address = await Address.findOne(
          { userId: order.customerId, isDefault: true },
          { phone: 1 }
        ).lean();

        // ✅ Filter legs belonging to this driver
        const driverLegs = order.legs.filter(
          (leg) => leg.driverId?.toString() === driverId
        );

        const vendorEstimates = await Promise.all(
          driverLegs.map(async (leg) => {
            try {
              const driver = await DriverDetail.findById(leg.driverId, {
                FullName: 1,
              }).lean();

              // Match vendor pickup with this leg.from coords
              const vendorOrder = order.vendors.find(
                (v) =>
                  v.pickupLatitude === leg.from.latitude &&
                  v.pickupLongitude === leg.from.longitude
              );

              if (!vendorOrder) {
                return {
                  legId: leg._id,
                  error: "No vendor matched for this delivery leg",
                };
              }

              const vendorData = await VendorDetail.findOne(
                { userId: vendorOrder.vendorId },
                { ownerName: 1, profilePicture: 1, businessPhone: 1 }
              ).lean();

              // Convert vendor profile image to presigned URL
              let vendorImageUrl = null;
              if (vendorData?.profilePicture) {
                const urls = await getPresignedImageUrls([
                  vendorData.profilePicture,
                ]);
                vendorImageUrl = urls[0] || null;
              }

              const productIds = vendorOrder.items.map(
                (item) => new mongoose.Types.ObjectId(item.productId)
              );
              const products = await Product.find(
                { _id: { $in: productIds } },
                { productName: 1, images: 1 }
              ).lean();

              const itemDetails = await Promise.all(
                vendorOrder.items.map(async (item) => {
                  const product = products.find(
                    (p) => p._id.toString() === item.productId.toString()
                  );

                  let productImageUrls = [];
                  if (product?.images?.length) {
                    productImageUrls = await getPresignedImageUrls(
                      product.images
                    );
                  }

                  return {
                    productId: item.productId,
                    productName: product?.productName || null,
                    quantity: item.quantity,
                    price: item.price,
                    totalPrice: item.totalPrice,
                    images: productImageUrls,
                  };
                })
              );

              // Distance Matrix API call
              const origins = `${vendorOrder.pickupLatitude},${vendorOrder.pickupLongitude}`;
              const destinations = `${order.dropLatitude},${order.dropLongitude}`;
              const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;
              const { data } = await axios.get(url);

              if (
                data.status !== "OK" ||
                data.rows[0].elements[0].status !== "OK"
              ) {
                return {
                  vendorId: vendorOrder.vendorId,
                  error:
                    "Failed to fetch distance/time from Google API or Cannot Deliverable due to pickup and drop location",
                };
              }

              const element = data.rows[0].elements[0];
              const distanceKm = element.distance.value / 1000;
              const durationText = element.duration_in_traffic
                ? element.duration_in_traffic.text
                : element.duration.text;

              return {
                vendorId: vendorOrder.vendorId,
                vendorName: vendorData?.ownerName || null,
                vendorImage: vendorImageUrl,
                status: vendorOrder.status,
                phoneNumber: vendorData?.businessPhone || null,
                driver: {
                  id: leg.driverId,
                  FullName: driver?.FullName || null,
                },
                distanceKm: distanceKm.toFixed(2),
                estimatedDeliveryTime: durationText,
                items: itemDetails,
                pickup: {
                  latitude: vendorOrder.pickupLatitude,
                  longitude: vendorOrder.pickupLongitude,
                  street: vendorOrder.pickupStreet,
                  city: vendorOrder.pickupCity,
                  state: vendorOrder.pickupState,
                  country: vendorOrder.pickupCountry,
                },
                drop: {
                  latitude: order.dropLatitude,
                  longitude: order.dropLongitude,
                  street: order.dropStreet,
                  city: order.dropCity,
                  state: order.dropState,
                  country: order.dropCountry,
                },
              };
            } catch (err) {
              return { error: err.message };
            }
          })
        );

        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          customer: {
            id: order.customerId,
            FullName: customer?.FullName || null,
            profileImage: customerProfileUrl,
            phoneNumber: address?.phone || "null",
          },
          totalItems: order.totalItems,
          subTotal: order.subTotal,
          shippingFee: order.shippingFee,
          grandTotal: order.grandTotal,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          vendors: vendorEstimates,
        };
      })
    );

    return success(res, orderData, "Orders for driver fetched successfully.");
  } catch (err) {
    console.error("Error fetching delivery estimate:", err);
    return serverError(res, err, "Failed to fetch delivery estimate.");
  }
};

// getOrderHistoryOfDriverBYId
export const getDriverOrderHistory = async (req, res) => {
  try {
    const driverId = req.user?.id;
    if (!driverId)
      return badRequest(res, null, "Unauthorized: Driver ID not found.");

    const driver = await DriverDetail.findOne(
      { userId: driverId },
      { FullName: 1, driverType: 1, vehicleType: 1 }
    ).lean();
    if (!driver) return notFound(res, null, "Driver not found.");

    // 🔹 Fetch orders where driver is assigned in legs
    const orders = await Order.find({
      "legs.driverId": driver._id,
    }).lean();

    if (!orders.length) {
      return success(
        res,
        { delivered: [], cancelled: [] },
        "No orders found for this driver."
      );
    }

    //  console.log(orders ,"=======orders==============");

    const deliveredOrders = [];
    const cancelledOrders = [];

    await Promise.all(
      orders.map(async (order) => {
        const customer = await CustomerDetail.findOne(
          { userId: order.customerId },
          { FullName: 1, profileImage: 1 }
        ).lean();

        let customerProfileImage = null;
        if (customer?.profileImage) {
          const [url] = await getPresignedImageUrls([customer.profileImage]);
          customerProfileImage = url || null;
        }

        // 🔹 Legs for this driver
        const driverLegs = order.legs.filter(
          (leg) => leg.driverId?.toString() === driver._id.toString()
        );

        // 🔹 Vendors linked to this order
        const enrichedVendors = await Promise.all(
          order.vendors.map(async (v) => {
            const vendorData = await VendorDetail.findOne(
              { userId: v.vendorId },
              { ownerName: 1, profilePicture: 1, businessPhone: 1 }
            ).lean();

            let vendorImage = null;
            if (vendorData?.profilePicture) {
              const [url] = await getPresignedImageUrls([
                vendorData.profilePicture,
              ]);
              vendorImage = url || null;
            }

            const enrichedItems = await Promise.all(
              v.items.map(async (item) => {
                const product = await Product.findById(item.productId, {
                  images: 1,
                  productName: 1,
                }).lean();

                let productImages = [];
                if (product?.images?.length) {
                  productImages = await getPresignedImageUrls(product.images);
                }

                return {
                  productId: item.productId,
                  productName: product?.productName || "Unknown Product",
                  quantity: item.quantity,
                  price: item.price,
                  totalPrice: item.totalPrice,
                  images: productImages,
                };
              })
            );

            return {
              vendorId: v.vendorId,
              vendorName: vendorData?.ownerName || "Unknown Vendor",
              vendorImage,
              phoneNumber: vendorData?.businessPhone || null,
              status: v.status,
              items: enrichedItems,
              pickup: {
                latitude: v.pickupLatitude,
                longitude: v.pickupLongitude,
                street: v.pickupStreet,
                city: v.pickupCity,
                state: v.pickupState,
                country: v.pickupCountry,
              },
              drop: {
                latitude: order.dropLatitude,
                longitude: order.dropLongitude,
                street: order.dropStreet,
                city: order.dropCity,
                state: order.dropState,
                country: order.dropCountry,
              },
            };
          })
        );

        // 🔹 Calculate driverEarnings
        let driverEarnings = 0;
        const normalizedDriverType = driver.driverType?.replace("-", "_") || "";

        const commissionConfig = await DriverCommission.findOne({
          driverType: normalizedDriverType,
          vehicle: driver.vehicleType,
        }).lean();

        if (commissionConfig) {
          driverEarnings = parseFloat(
            (
              (order.grandTotal * commissionConfig.commissionPercentage) /
              100
            ).toFixed(2)
          );
        }

        const formattedOrder = {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          createdAt: order.createdAt,
          driver: {
            id: driver._id,
            fullName: driver.FullName,
          },
          customer: {
            id: order.customerId,
            fullName: customer?.FullName || "Unknown Customer",
            profileImage: customerProfileImage,
          },
          totalItems: order.totalItems,
          subTotal: order.subTotal,
          shippingFee: order.shippingFee,
          grandTotal: order.grandTotal,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          driverEarnings, // 🔹 added here
          vendors: enrichedVendors,
          legs: driverLegs, // 🔹 include driver-specific legs
        };

        // 🔹 Mark history status
        if (order.vendors.some((v) => v.status === "delivered")) {
          deliveredOrders.push(formattedOrder);
        } else if (order.vendors.some((v) => v.status === "cancelled")) {
          cancelledOrders.push(formattedOrder);
        }
      })
    );

    return success(
      res,
      { delivered: deliveredOrders, cancelled: cancelledOrders },
      "Driver order history fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching driver order history:", err);
    return serverError(res, err, "Failed to fetch driver order history.");
  }
};

// Return Orders...

/**
 * 1. Request Return (Customer)
 */
export const requestReturn = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return JsonRes.notFound(res, null, "Order not found.");

    // Initialize return request
    order.returnRequest = {
      isRequested: true,
      status: "requested",
      reason: reason || "",
      requestedAt: new Date(),
    };

    await order.save();
    return JsonRes.success(res, order, "Return request submitted.");
  } catch (error) {
    return JsonRes.serverError(res, error, "Failed to request return.");
  }
};

/**
 * 2. Assign Driver (Admin/Vendor)
 */
export const assignReturnDriver = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order || !order.returnRequest?.isRequested)
      return JsonRes.notFound(res, null, "Return request not found.");

    // Customer location for pickup
    if (!order.dropLatitude || !order.dropLongitude)
      return JsonRes.badRequest(res, null, "Customer pickup location missing.");

    const pickupCoords = [order.dropLongitude, order.dropLatitude];

    // Find nearest available driver
    const driver = await DriverDetail.findOne({
      isAvailable: true,
      isDelivering: false,
      status: "Approved",
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: pickupCoords },
          $maxDistance: 1000000, // 10km
        },
      },
    });

    if (!driver)
      return JsonRes.badRequest(res, null, "No available drivers nearby.");

    driver.isAvailable = false;
    driver.isDelivering = true;
    await driver.save();

    order.returnRequest.driverId = driver._id;
    order.returnRequest.status = "driver-assigned";
    await order.save();

    return JsonRes.success(
      res,
      order,
      "Driver assigned for return successfully."
    );
  } catch (error) {
    return JsonRes.serverError(res, error, "Failed to assign return driver.");
  }
};

/**
 * 3. Pickup Confirmation (Driver)
 */
export const confirmPickup = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order || order.returnRequest?.status !== "driver-assigned")
      return JsonRes.badRequest(res, null, "Pickup cannot be confirmed.");

    order.returnRequest.status = "picked";
    order.returnRequest.pickedUpAt = new Date();
    await order.save();

    return JsonRes.success(res, order, "Pickup confirmed by driver.");
  } catch (error) {
    return JsonRes.serverError(res, error, "Failed to confirm pickup.");
  }
};

/**
 * 4. Vendor Receipt Confirmation
 */
export const confirmVendorReceipt = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order || order.returnRequest?.status !== "picked")
      return JsonRes.badRequest(
        res,
        null,
        "Vendor receipt cannot be confirmed."
      );

    // Step 1: Mark vendor receipt
    order.returnRequest.status = "vendor-received";
    order.returnRequest.receivedAt = new Date();

    // Step 2: Automatically complete return
    order.returnRequest.status = "completed";
    order.returnRequest.completedAt = new Date();
    order.vendors.status = "returned"; // Update overall order status

    await order.save();

    // Step 3: Make assigned driver available again
    if (order.returnRequest?.driverId) {
      const driver = await DriverDetail.findById(order.returnRequest.driverId);
      if (driver) {
        driver.isAvailable = true;
        driver.isDelivering = false;
        await driver.save();
      }
    }

    return JsonRes.success(
      res,
      order,
      "Vendor receipt confirmed, driver released, and return process completed."
    );
  } catch (error) {
    return JsonRes.serverError(res, error, "Failed to confirm vendor receipt.");
  }
};

// Get Acive Orders for Customer
export const getActiveOrdersForCustomer = async (req, res) => {
  try {
    const customerId = req.user?.id;

    if (!customerId) {
      return badRequest(res, null, "Customer authentication required.");
    }

    const activeStatuses = [
      "pending",
      "confirmed",
      "Ready",
      "driver-accepted",
      "picked",
    ];

    // Fetch orders that have at least one active vendor
    const orders = await Order.find({
      customerId,
      "vendors.status": { $in: activeStatuses },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!orders.length) {
      return success(res, [], "No active orders found for this customer.");
    }

    // Collect product and vendor IDs only from active vendors
    const productIds = [];
    const vendorIds = new Set();

    orders.forEach((order) => {
      order.vendors
        .filter((v) => activeStatuses.includes(v.status)) // only active vendors
        .forEach((v) => {
          vendorIds.add(v.vendorId.toString());
          v.items.forEach((item) => {
            productIds.push(item.productId.toString());
          });
        });
    });

    // Convert vendorIds to ObjectId (for userId field)
    const vendorObjectIds = [...vendorIds]
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          console.warn(`Invalid vendorId skipped: ${id}`);
          return null;
        }
      })
      .filter(Boolean);

    // Fetch vendor details where userId matches
    const vendorsData = await VendorDetail.find(
      { userId: { $in: vendorObjectIds } },
      { ownerName: 1, userId: 1 }
    ).lean();

    // Map userId -> ownerName
    const vendorMap = {};
    vendorsData.forEach((v) => {
      vendorMap[v.userId.toString()] = v.ownerName || null;
    });

    // Fetch product names (optional if needed)
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = p.productName;
    });

    // Build response with only active vendors
    const responseData = orders.map((order) => ({
      orderId: order._id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      vendors: order.vendors
        .filter((v) => activeStatuses.includes(v.status)) // ✅ filter delivered
        .map((v) => ({
          vendorId: v.vendorId,
          vendorName: vendorMap[v.vendorId.toString()] || null,
          status: v.status,
        })),
    }));

    return success(res, responseData, "Active orders fetched successfully.");
  } catch (err) {
    console.error("Error fetching active orders for customer:", err);
    return serverError(res, err, "Failed to fetch active orders.");
  }
};

export const getActiveOrderByOrderIdAndVendorId = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;

    // Validate inputs
    if (!orderId || !vendorId) {
      return badRequest(res, null, "Order ID and Vendor ID are required.");
    }

    const activeStatuses = [
      "pending",
      "confirmed",
      "ready",
      "driver-accepted",
      "picked",
    ];

    // Query using $elemMatch for vendorId + status
    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(orderId),
      vendors: {
        $elemMatch: {
          vendorId: new mongoose.Types.ObjectId(vendorId),
          status: { $in: activeStatuses },
        },
      },
    }).lean();

    if (!order) {
      return success(
        res,
        null,
        "No active order found for this Order ID and Vendor."
      );
    }

    // Filter only the vendor that matched
    order.vendors = order.vendors.filter(
      (v) =>
        v.vendorId.toString() === vendorId && activeStatuses.includes(v.status)
    );

    // Gather product IDs for this vendor
    const productIds = order.vendors.flatMap((v) =>
      v.items.map((item) => item.productId.toString())
    );

    // Fetch product names
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = p.productName;
    });

    // Prepare response
    const responseData = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      totalItems: order.totalItems,
      subTotal: order.subTotal,
      shippingFee: order.shippingFee,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      vendors: order.vendors.map((v) => ({
        vendorId: v.vendorId,
        status: v.status,
        pickupLocation: {
          latitude: v.pickupLatitude,
          longitude: v.pickupLongitude,
          street: v.pickupStreet,
          city: v.pickupCity,
          state: v.pickupState,
          country: v.pickupCountry,
        },
        items: v.items.map((item) => ({
          productId: item.productId,
          productName: productMap[item.productId.toString()] || null,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
        })),
      })),
      dropLocation: {
        latitude: order.dropLatitude,
        longitude: order.dropLongitude,
        street: order.dropStreet,
        city: order.dropCity,
        state: order.dropState,
        country: order.dropCountry,
      },
    };

    return success(res, responseData, "Active order fetched successfully.");
  } catch (err) {
    console.error("Error fetching active order by Order ID:", err);
    return serverError(res, err, "Failed to fetch active order.");
  }
};

// getOrderHistoryOfCustomer
export const getOrderHistoryOfCustomer = async (req, res) => {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return badRequest(res, null, "Customer authentication required.");
    }

    // 🔎 Get filters from query
    const { search, status, returnStatus } = req.query;

    const orders = await Order.find({ customerId })
      .sort({ createdAt: -1 })
      .lean();

    if (!orders.length) {
      return success(res, [], "No order history found for this customer.");
    }

    // Collect all productIds from vendors.items
    const allProductIds = orders.flatMap((order) =>
      (order.vendors || [])
        .flatMap((v) => (v.items || []).map((i) => i.productId))
        .filter(Boolean)
    );

    // Fetch product details
    const products = await Product.find({ _id: { $in: allProductIds } })
      .select("_id productName price discountedprice images")
      .lean();

    // Map productId -> details
    const productDetailsMap = {};
    for (const product of products) {
      let images = [];
      try {
        images = await getPresignedImageUrls(product.images || []);
      } catch (e) {
        console.error(
          "Image fetch failed for product:",
          product._id,
          e?.message
        );
      }
      productDetailsMap[product._id.toString()] = {
        productName: product.productName,
        price: product.price,
        discountedprice: product.discountedprice,
        images,
      };
    }

    // Transform response (keep original structure)
    let formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      totalItems: order.totalItems,
      subTotal: order.subTotal,
      shippingFee: order.shippingFee,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      type: order.type,
      vendors: (order.vendors || []).map((vendor) => ({
        vendorId: vendor.vendorId,
        driverId: vendor.driverId || null,
        status: vendor.status,
        pickupLatitude: vendor.pickupLatitude,
        pickupLongitude: vendor.pickupLongitude,
        pickupStreet: vendor.pickupStreet,
        pickupCity: vendor.pickupCity,
        pickupState: vendor.pickupState,
        pickupCountry: vendor.pickupCountry,
        items: (vendor.items || []).map((item) => {
          const details = productDetailsMap[item.productId?.toString()] || {};
          return {
            productId: item.productId,
            productName: details.productName || item.productName || null,
            price: details.price || item.price,
            discountedPrice: details.discountedprice || null,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            images: details.images || [],
          };
        }),
      })),
      returnRequest: order.returnRequest || null,
    }));

    // 🔍 Apply search filter (productName) – trim down items & vendors
    if (search) {
      formattedOrders = formattedOrders
        .map((order) => {
          const filteredVendors = order.vendors
            .map((vendor) => {
              const filteredItems = vendor.items.filter((i) =>
                i.productName?.toLowerCase().includes(search.toLowerCase())
              );
              return { ...vendor, items: filteredItems };
            })
            .filter((v) => v.items.length > 0); // keep vendor only if it has matching items

          return { ...order, vendors: filteredVendors };
        })
        .filter((order) => order.vendors.length > 0); // keep order only if it has matching vendors
    }

    // 📌 Apply vendor status filter
    if (status) {
      formattedOrders = formattedOrders
        .map((order) => {
          const filteredVendors = order.vendors.filter(
            (v) => v.status === status
          );
          return { ...order, vendors: filteredVendors };
        })
        .filter((order) => order.vendors.length > 0);
    }

    // 📌 Apply returnRequest status filter
    if (returnStatus) {
      formattedOrders = formattedOrders.filter(
        (order) => order.returnRequest?.status === returnStatus
      );
    }

    return success(res, formattedOrders, "Order history fetched successfully.");
  } catch (err) {
    console.error("Error fetching order history:", err?.message, err?.stack);
    return serverError(res, err, "Failed to fetch order history.");
  }
};

// Admin - Financial Breakdown
export const getAdminFinancialBreakdown = async (req, res) => {
  try {
    const user = req.user;
    const {
      vendorId: queryVendorId,
      page = 1,
      pageSize = 10,
      search = "",
    } = req.query;

    // --- Base filter: only consider paid + delivered orders ---
    let filter = {
      "vendors.paymentStatus": "paid",
      "vendors.status": "delivered",
    };

    if (user.role === "vendor") {
      filter["vendors.vendorId"] = user.id;
    } else if (user.role === "admin" && queryVendorId) {
      filter["vendors.vendorId"] = queryVendorId;
    }

    // --- Fetch orders ---
    let query = Order.find(filter)
      .populate(
        "vendors.items.productId",
        "category productName price discountedprice"
      )
      .populate("vendors.vendorId", "email name")
      .lean();

    const orders = await query;

    // --- Preload categories for commission lookup ---
    const categories = await Category.find().select("commission").lean();
    const categoryMap = categories.reduce((acc, cat) => {
      acc[cat._id.toString()] = cat;
      return acc;
    }, {});

    let breakdowns = [];

    for (const order of orders) {
      for (const vendorBlock of order.vendors || []) {
        if (vendorBlock.status !== "delivered") continue;

        // 🧩 Find the driver from legs with delivered status
        const deliveredLeg = (order.legs || []).find(
          (leg) => leg.status === "delivered" && leg.driverId
        );
        if (!deliveredLeg || !deliveredLeg.driverId) continue;

        const driverId = deliveredLeg.driverId;

        // Vendor access control
        if (
          user.role === "vendor" &&
          vendorBlock.vendorId?._id?.toString() !== user.id.toString()
        ) {
          continue;
        }
        if (
          user.role === "admin" &&
          queryVendorId &&
          vendorBlock.vendorId?._id?.toString() !== queryVendorId
        ) {
          continue;
        }

        const grandTotal = order.grandTotal || 0;

        // ✅ Driver earnings calculation
        let driverEarnings = 0;
        const driverDetail = await DriverDetail.findById(driverId).lean();

        if (driverDetail) {
          // normalize keys (driverType in db = "full-time", commission = "full_time")
          const normalizedDriverType =
            driverDetail.driverType?.replace("-", "_") || "";

          const commissionConfig = await DriverCommission.findOne({
            driverType: normalizedDriverType,
            vehicle: driverDetail.vehicleType,
          }).lean();

          if (commissionConfig) {
            driverEarnings = parseFloat(
              (
                (grandTotal * commissionConfig.commissionPercentage) /
                100
              ).toFixed(2)
            );
          }
        }

        // ✅ Admin commission
        let adminCommission = 0;
        for (const item of vendorBlock.items || []) {
          const product = item.productId;
          if (!product?.category) continue;

          const category = categoryMap[product.category.toString()];
          if (!category) continue;

          const rate = category.commission || 0;
          const itemTotal = item.totalPrice || 0;
          adminCommission += parseFloat(((itemTotal * rate) / 100).toFixed(2));
        }

        // ✅ Vendor earnings
        const vendorEarnings = parseFloat(
          (grandTotal - driverEarnings - adminCommission).toFixed(2)
        );

        breakdowns.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          vendor: vendorBlock.vendorId,
          grandTotal,
          driverEarnings,
          adminCommission,
          vendorEarnings,
          createdAt: order.createdAt,
        });
      }
    }

    // --- Apply search (orderNumber OR vendor email) ---
    let filteredBreakdowns = breakdowns;
    if (search) {
      const regex = new RegExp(search, "i");
      filteredBreakdowns = breakdowns.filter(
        (b) => regex.test(b.orderNumber) || regex.test(b.vendor?.email || "")
      );
    }

    // --- Pagination ---
    const total = filteredBreakdowns.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = filteredBreakdowns.slice(
      startIndex,
      startIndex + parseInt(pageSize)
    );

    return success(
      res,
      {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        data: paginated,
      },
      "Financial breakdown of Admin retrieved successfully."
    );
  } catch (err) {
    console.error("Error in financial breakdown:", err);
    return serverError(res, err, "Failed to fetch financial breakdown stage.");
  }
};

// vendor financial breakdown
export const getVendorFinancialBreakdown = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, pageSize = 10, search = "" } = req.query;

    // --- Fetch only delivered + paid vendor orders ---
    const orders = await Order.find({
      "vendors.vendorId": vendorId,
      "vendors.status": "delivered",
      "vendors.paymentStatus": "paid",
    })
      .populate(
        "vendors.items.productId",
        "category productName price discountedprice"
      )
      .populate("vendors.vendorId", "email name")
      .lean();

    // --- Preload categories for commission lookup ---
    const categories = await Category.find().select("commission").lean();
    const categoryMap = categories.reduce((acc, cat) => {
      acc[cat._id.toString()] = cat;
      return acc;
    }, {});

    let breakdowns = [];

    for (const order of orders) {
      // Find only this vendor's block
      const vendorBlock = order.vendors.find(
        (vendor) => vendor.vendorId._id.toString() === vendorId.toString()
      );
      if (!vendorBlock) continue;

      const grandTotal = order.grandTotal || 0;

      // --- 🧩 Find the driver from legs with delivered status ---
      const deliveredLeg = (order.legs || []).find(
        (leg) => leg.status === "delivered" && leg.driverId
      );
      let driverEarnings = 0;

      if (deliveredLeg && deliveredLeg.driverId) {
        const driverDetail = await DriverDetail.findById(
          deliveredLeg.driverId
        ).lean();

        if (driverDetail) {
          const normalizedDriverType =
            driverDetail.driverType?.replace("-", "_") || "";

          const commissionConfig = await DriverCommission.findOne({
            driverType: normalizedDriverType,
            vehicle: driverDetail.vehicleType,
          }).lean();

          if (commissionConfig) {
            driverEarnings = parseFloat(
              (
                (grandTotal * commissionConfig.commissionPercentage) /
                100
              ).toFixed(2)
            );
          }
        }
      }

      // --- 🧾 Admin commission ---
      let adminCommission = 0;
      for (const item of vendorBlock.items || []) {
        const product = item.productId;
        if (!product?.category) continue;

        const category = categoryMap[product.category.toString()];
        if (!category) continue;

        const rate = category.commission || 0;
        const itemTotal = item.totalPrice || 0;
        adminCommission += parseFloat(((itemTotal * rate) / 100).toFixed(2));
      }

      // --- 💰 Vendor earnings ---
      const vendorEarnings = parseFloat(
        (grandTotal - driverEarnings - adminCommission).toFixed(2)
      );

      breakdowns.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        vendor: vendorBlock.vendorId,
        grandTotal,
        driverEarnings,
        adminCommission,
        vendorEarnings,
        createdAt: order.createdAt,
      });
    }

    // --- 🔍 Search filter ---
    let filteredBreakdowns = breakdowns;
    if (search) {
      const regex = new RegExp(search, "i");
      filteredBreakdowns = breakdowns.filter(
        (b) => regex.test(b.orderNumber) || regex.test(b.vendor?.email || "")
      );
    }

    // --- 📄 Pagination ---
    const total = filteredBreakdowns.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = filteredBreakdowns.slice(
      startIndex,
      startIndex + parseInt(pageSize)
    );

    return success(
      res,
      {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        data: paginated,
      },
      "Vendor financial breakdown retrieved successfully."
    );
  } catch (err) {
    console.error("Error in vendor financial breakdown:", err);
    return serverError(
      res,
      err,
      "Failed to fetch vendor financial breakdown stage."
    );
  }
};

// driver financial breakdown
export const getDriverFinancialBreakdown = async (req, res) => {
  try {
    const driverUserId = req.user.id;
    const { page = 1, pageSize = 10, search = "" } = req.query;

    // 🔹 Get driverDetails._id for this user
    const driverDetails = await DriverDetail.findOne({
      userId: driverUserId,
    }).lean();
    if (!driverDetails) {
      return success(
        res,
        { total: 0, page: 1, pageSize: 10, data: [] },
        "No driver found."
      );
    }
    const driverId = driverDetails._id;

    // 🔹 Fetch orders where this driver is assigned in legs + vendors delivered + paid
    const orders = await Order.find({
      "legs.driverId": driverId,
      "vendors.status": "delivered",
      "vendors.paymentStatus": "paid",
    })
      .populate(
        "vendors.items.productId",
        "category productName price discountedprice"
      )
      .populate("vendors.vendorId", "email name")
      .lean();

    let breakdowns = [];

    for (const order of orders) {
      // 🔹 find all vendors of this order (driver is linked by legs, not vendor)
      for (const vendorBlock of order.vendors) {
        if (vendorBlock.status !== "delivered") continue;
        if (vendorBlock.paymentStatus !== "paid") continue;

        const grandTotal = order.grandTotal || 0;

        // --- Driver earnings (based on driverType + vehicle)
        let driverEarnings = 0;
        const normalizedDriverType =
          driverDetails.driverType?.replace("-", "_") || "";

        const commissionConfig = await DriverCommission.findOne({
          driverType: normalizedDriverType,
          vehicle: driverDetails.vehicleType,
        }).lean();

        if (commissionConfig) {
          driverEarnings = parseFloat(
            (
              (grandTotal * commissionConfig.commissionPercentage) /
              100
            ).toFixed(2)
          );
        }

        // --- Admin commission (from category)
        let adminCommission = 0;
        if (vendorBlock.items?.length) {
          const firstProduct = vendorBlock.items[0].productId;
          if (firstProduct?.category) {
            const category = await Category.findById(
              firstProduct.category
            ).lean();
            if (category) {
              const rate = category.commission || 0;
              adminCommission = parseFloat(
                ((grandTotal * rate) / 100).toFixed(2)
              );
            }
          }
        }

        // --- Vendor earnings
        const vendorEarnings = parseFloat(
          (grandTotal - driverEarnings - adminCommission).toFixed(2)
        );

        const products =
          vendorBlock.items?.map((item) => ({
            productId: item.productId?._id,
            productName: item.productId?.productName || "",
          })) || [];

        breakdowns.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: vendorBlock.paymentStatus,
          paymentMethod: order.paymentMethod,
          driver: {
            id: driverId,
            fullName: driverDetails.FullName,
          },
          vendor: vendorBlock.vendorId,
          grandTotal,
          driverEarnings,
          adminCommission,
          vendorEarnings,
          products,
          createdAt: order.createdAt,
        });
      }
    }

    // 🔹 Search filter
    let filteredBreakdowns = breakdowns;
    if (search) {
      const regex = new RegExp(search, "i");
      filteredBreakdowns = breakdowns.filter(
        (b) =>
          regex.test(b.orderNumber) ||
          regex.test(b.driver?.fullName || "") ||
          regex.test(b.vendor?.email || "")
      );
    }

    // 🔹 Pagination
    const total = filteredBreakdowns.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = filteredBreakdowns.slice(
      startIndex,
      startIndex + parseInt(pageSize)
    );

    return success(
      res,
      {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        data: paginated,
      },
      "Driver financial breakdown retrieved successfully."
    );
  } catch (err) {
    console.error("Error in driver financial breakdown:", err);
    return serverError(res, err, "Failed to fetch driver financial breakdown.");
  }
};
