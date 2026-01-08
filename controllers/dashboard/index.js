import { hash } from "bcryptjs";
import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";
import Product from "../../models/product/products.js";
import Order from "../../models/order/order.js";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import DriverDetail from "../../models/driverDetails/driverDetails.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import mongoose from "mongoose";
import Review from "../../models/review/review.js";
import jwt from "jsonwebtoken";
import { ROLES } from "../../utils/constant.js";
import crypto from "crypto";
import { COLORS } from "../../utils/constant.js";
import { sendMail } from "../../helpers/mail.js";
import { getUTCRangeForLocalDate } from "../../helpers/utc.js";
import moment from "moment-timezone";
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

export const getDailySales = async (req, res) => {
  try {
    const { date, timezone = "UTC" } = req.query;
    const vendorId = req.user.id;

    /* 1️⃣ validate the date */
    if (!moment(date, "YYYY-MM-DD", true).isValid()) {
      return badRequest(res, null, "Invalid date format. Use YYYY-MM-DD.");
    }

    /* 2️⃣ work out the UTC range for that local date */
    const { startUTC, endUTC } = getUTCRangeForLocalDate(date, timezone);
    const dateFilter = { createdAt: { $gte: startUTC, $lte: endUTC } };

    /* 3️⃣ aggregate vendor-specific sales */
    const salesAgg = await Order.aggregate([
      { $match: { ...dateFilter, paymentStatus: "paid" } },
      { $unwind: "$vendors" },
      { $match: { "vendors.vendorId": new mongoose.Types.ObjectId(vendorId) } },
      { $unwind: "$vendors.items" },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$vendors.items.totalPrice" },
        },
      },
    ]);

    const totalSales = salesAgg.length > 0 ? salesAgg[0].totalSales : 0;

    /* 4️⃣ count pending / cancelled / refunded vendor blocks */
    const pendingOrders = await Order.countDocuments({
      vendors: { $elemMatch: { vendorId, status: "pending" } },
    });

    const cancelledOrders = await Order.countDocuments({
      vendors: { $elemMatch: { vendorId, status: "cancelled" } },
    });

    const refundedOrders = await Order.countDocuments({
      paymentStatus: "refunded",
      "vendors.vendorId": vendorId,
    });

    /* 5️⃣ Top 3 Customers for this vendor */
    const topCustomers = await Order.aggregate([
      // Unwind vendors first
      { $unwind: "$vendors" },

      // Only include vendors belonging to this vendorId with paid status
      {
        $match: {
          "vendors.vendorId": new mongoose.Types.ObjectId(String(vendorId)),
          "vendors.paymentStatus": "paid",
        },
      },

      // Unwind items inside this vendor block
      { $unwind: "$vendors.items" },

      // Group by customer
      {
        $group: {
          _id: "$customerId",
          totalOrders: { $sum: 1 }, // counts items (or orders if you adjust)
          totalSpent: { $sum: "$vendors.items.totalPrice" }, // vendor-based spending
        },
      },

      // Lookup customer details
      {
        $lookup: {
          from: "customerdetails",
          localField: "_id",
          foreignField: "userId",
          as: "customerInfo",
        },
      },

      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },

      // Final projection
      {
        $project: {
          customerId: "$_id",
          name: "$customerInfo.FullName",
          phone: "$customerInfo.Phone",
          totalOrders: 1,
          totalSpent: 1,
        },
      },

      // Sort and limit to top 3
      { $sort: { totalSpent: -1 } },
      { $limit: 3 },
    ]);

    // console.log(topCustomers);
    /* 6️⃣ success response */
    return success(
      res,
      {
        totalSales,
        pendingOrders,
        cancelledOrders,
        refundedOrders,
        topCustomers,
        date,
        timezone,
      },
      "Vendor daily sales data retrieved successfully."
    );
  } catch (err) {
    console.error("Error in getDailySales:", err);
    return serverError(res, err, "Failed to retrieve daily sales.");
  }
};

export const getAdminDashboards = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Vendor requests (pending)
    const vendorReqCount = await VendorDetail.countDocuments({
      status: "Pending",
      profileComplete: true,
    });

    // 2️⃣ Driver requests (pending)
    const driverReqCount = await DriverDetail.countDocuments({
      status: "Pending",
      profileComplete: true,
    });

    // 3️⃣ Active orders (exclude delivered + cancelled)
    const activeOrderCount = await Order.countDocuments({
      vendors: {
        $elemMatch: {
          status: { $nin: ["delivered", "cancelled"] },
        },
      },
    });

    // -------------------------
    // 4️⃣ Approved vendors (current total)
    const totalApprovedVendors = await VendorDetail.countDocuments({
      status: "Approved",
    });

    // 5️⃣ Total customers
    const totalCustomers = await CustomerDetail.countDocuments();
    // 🔥 Extra: Calculate difference from previous month
    const now = new Date();

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    );

    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const approvedThisMonth = await VendorDetail.countDocuments({
      status: "Approved",
      approvedAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
    });

    const approvedLastMonth = await VendorDetail.countDocuments({
      status: "Approved",
      approvedAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
    });

    let approvedDiff = approvedThisMonth - approvedLastMonth;
    let approvedDiffFormatted =
      approvedDiff > 0 ? `+${approvedDiff}` : `${approvedDiff}`;

    // -------------------------
    // 6️⃣ Return Rate
    const totalOrders = await Order.countDocuments();
    const returnedOrders = await Order.countDocuments({
      "returnRequest.isRequested": true,
    });
    const returnRate =
      totalOrders > 0 ? ((returnedOrders / totalOrders) * 100).toFixed(2) : 0;

    // 7️⃣ Average Order Value
    const aovResult = await Order.aggregate([
      { $group: { _id: null, avgValue: { $avg: "$grandTotal" } } },
    ]);
    const avgOrderValue = aovResult.length
      ? aovResult[0].avgValue.toFixed(2)
      : 0;

    const maxOrderResult = await Order.aggregate([
      { $group: { _id: null, maxValue: { $max: "$grandTotal" } } },
    ]);
    const maxOrderValue = maxOrderResult.length
      ? parseFloat(maxOrderResult[0].maxValue.toFixed(2))
      : 0;

    const avgOrderValuePercentage =
      maxOrderValue > 0
        ? ((avgOrderValue / maxOrderValue) * 100).toFixed(2)
        : 0;

    // 8️⃣ Customer Satisfaction
    const ratingResult = await Review.aggregate([
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ]);
    const customerSatisfaction = ratingResult.length
      ? ratingResult[0].avgRating.toFixed(1)
      : "0.0";

    // 9️⃣ Recent Orders
    const recentOrders = await Order.aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 4 },
      {
        $lookup: {
          from: "users",
          localField: "customerId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $lookup: {
          from: "customerdetails",
          localField: "userInfo._id",
          foreignField: "userId",
          as: "customerInfo",
        },
      },
      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderNumber: 1,
          amount: "$grandTotal",
          status: { $arrayElemAt: ["$vendors.status", 0] },
          date: "$createdAt",
          customer: { $ifNull: ["$customerInfo.FullName", "Unknown"] },
          email: "$userInfo.email",
        },
      },
    ]);

    const topOrders = recentOrders.map((order) => ({
      orderNumber: order.orderNumber,
      customer: order.customer || "Unknown",
      amount: order.amount,
      status: order.status || "N/A",
      date: order.date,
      email: order.email,
    }));

    // 🔝 Top Vendors
    const topVendors = await Order.aggregate([
      { $unwind: "$vendors" },
      { $unwind: "$vendors.items" },
      {
        $group: {
          _id: "$vendors.vendorId",
          totalOrders: { $sum: 1 },
          totalSales: { $sum: "$vendors.items.totalPrice" },
        },
      },
      {
        $lookup: {
          from: "vendordetails",
          localField: "_id",
          foreignField: "userId",
          as: "vendorInfo",
        },
      },
      { $unwind: "$vendorInfo" },
      {
        $project: {
          vendorId: "$_id",
          name: "$vendorInfo.businessName",
          totalOrders: 1,
          totalSales: 1,
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 3 },
    ]);

    // 🔝 Top Customers
    const topCustomers = await Order.aggregate([
      {
        $group: {
          _id: "$customerId",
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$grandTotal" },
        },
      },
      {
        $lookup: {
          from: "customerdetails",
          localField: "_id",
          foreignField: "userId",
          as: "customerInfo",
        },
      },
      { $unwind: "$customerInfo" },
      {
        $project: {
          customerId: "$_id",
          name: "$customerInfo.FullName",
          totalOrders: 1,
          totalSpent: 1,
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 3 },
    ]);

    // 📊 Category Distribution
    const categorySales = await Order.aggregate([
      { $unwind: "$vendors" },
      { $unwind: "$vendors.items" },
      {
        $lookup: {
          from: "products",
          localField: "vendors.items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category.category",
          totalSales: { $sum: "$vendors.items.totalPrice" },
        },
      },
    ]);

    const totalCategorySales = categorySales.reduce(
      (sum, c) => sum + c.totalSales,
      0
    );

    const categoryDistribution = categorySales.map((c) => ({
      name: c._id,
      value:
        totalCategorySales > 0
          ? ((c.totalSales / totalCategorySales) * 100).toFixed(2)
          : 0,
    }));

    // ✅ Return all data including totalCustomers
    return success(
      res,
      {
        vendorReqCount,
        driverReqCount,
        activeOrderCount,
        totalApprovedVendors,
        totalCustomers,
        approvedThisMonth,
        approvedLastMonth,
        approvedDiff: approvedDiffFormatted,
        returnRate: `${returnRate}%`,
        avgOrderValue: `${avgOrderValue}`,
        customerSatisfaction,
        recentOrders: topOrders,
        avgOrderValuePercentage,
        topVendors,
        topCustomers,
        categoryDistribution,
      },
      "Dashboard stats retrieved successfully."
    );
  } catch (err) {
    console.error("Error in getDashboardStats:", err);
    return serverError(res, err, "Failed to fetch dashboard stats.");
  }
};


export const getAdminSalesLineGraph = async (req, res) => {
  try {
    // 🟢 Get days from query (default = 30)
    const { days = 30 } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));

    // 🔹 Aggregate total sales grouped by day
    const sales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          "vendors.status": { $nin: ["cancelled", "returned"] }, // remove cancelled & returned
        },
      },
      { $unwind: "$vendors" },
      { $unwind: "$vendors.items" },
      {
        $match: {
          "vendors.status": { $nin: ["cancelled", "returned"] }, // double-check after unwind
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }, // group by day
          },
          totalSales: { $sum: "$vendors.items.totalPrice" },
        },
      },
      { $sort: { _id: 1 } }, // sort by date ascending
    ]);

    // Format response
    const formattedSales = sales.map((s) => ({
      date: s._id,
      totalSales: Number(s.totalSales.toFixed(2)),
    }));

    return success(
      res,
      {
        range: { startDate, endDate, days },
        sales: formattedSales,
      },
      "Sales data retrieved successfully."
    );
  } catch (err) {
    console.error("Error in getAdminSalesLineGraph:", err);
    return serverError(res, err, "Failed to fetch sales data.");
  }
};
