import { hash } from "bcryptjs";
import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";
import Product from "../../models/product/products.js";
import Order from "../../models/order/order.js";
import mongoose from "mongoose";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
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

export const getSalesReport = async (req, res) => {
  try {
    const vendorId = req.user.id;
    console.log("Vendor ID:", vendorId);
    // Validate vendorId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return badRequest(res, "Invalid vendor ID");
    }

    const vendorObjectId = new mongoose.Types.ObjectId(String(vendorId));

    // Optional: date filter
    const { startDate, endDate } = req.query;
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    }
    console.log(dateFilter);
    // Helper function to round to 2 decimal places
    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    // Calculate previous period dates for comparison
    let previousStartDate, previousEndDate;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const periodDuration = end - start;

      previousStartDate = new Date(start.getTime() - periodDuration);
      previousEndDate = new Date(end.getTime() - periodDuration);
    }

    // Get vendor-specific sales for current period
    const orders = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          "vendors.vendorId": vendorObjectId,
        },
      },
      { $unwind: "$vendors" },
      { $match: { "vendors.vendorId": vendorObjectId } },
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
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderId: "$_id",
          orderNumber: 1,
          createdAt: 1,
          productId: "$product._id",
          productName: "$product.productName",
          category: "$category.category",
          quantity: "$vendors.items.quantity",
          price: "$vendors.items.price",
          totalPrice: "$vendors.items.totalPrice",
          status: "$vendors.status",
          customerId: "$customerId",
        },
      },
    ]);

    // Get previous period data for comparison
    let previousPeriodOrders = [];
    let previousPeriodCustomers = new Set();
    let previousProductSales = [];

    if (startDate && endDate) {
      // Get previous period orders for general metrics
      previousPeriodOrders = await Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: previousStartDate,
              $lte: previousEndDate,
            },
            "vendors.vendorId": vendorObjectId,
          },
        },
        { $unwind: "$vendors" },
        { $match: { "vendors.vendorId": vendorObjectId } },
        { $unwind: "$vendors.items" },
        {
          $project: {
            totalPrice: "$vendors.items.totalPrice",
            quantity: "$vendors.items.quantity",
            customerId: "$userId",
          },
        },
      ]);

      // Get unique customers from previous period
      previousPeriodOrders.forEach((order) => {
        if (order.customerId) {
          previousPeriodCustomers.add(order.customerId.toString());
        }
      });

      // Get previous period data for product trend calculation
      previousProductSales = await Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: previousStartDate,
              $lte: previousEndDate,
            },
            "vendors.vendorId": vendorObjectId,
          },
        },
        { $unwind: "$vendors" },
        { $match: { "vendors.vendorId": vendorObjectId } },
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
          $group: {
            _id: "$product._id",
            previousSales: { $sum: "$vendors.items.totalPrice" },
            previousUnits: { $sum: "$vendors.items.quantity" },
          },
        },
      ]);
    }

    // Calculate KPIs for current period
    const totalRevenue = roundToTwo(
      orders.reduce((sum, o) => sum + o.totalPrice, 0)
    );
    const totalOrders = new Set(orders.map((o) => o.orderId.toString())).size;
    const totalUnits = orders.reduce((sum, o) => sum + o.quantity, 0);

    // Get unique customers for current period
    // console.log(orders);
    const currentCustomers = new Set();
    orders.forEach((order) => {
      if (order.customerId) {
        currentCustomers.add(order.customerId.toString());
      }
    });
    const activeCustomers = currentCustomers.size;

    // Calculate KPIs for previous period
    const prevTotalRevenue = roundToTwo(
      previousPeriodOrders.reduce((sum, o) => sum + o.totalPrice, 0)
    );
    const prevTotalOrders = new Set(
      previousPeriodOrders.map((o) => o._id?.toString())
    ).size;
    const prevTotalUnits = previousPeriodOrders.reduce(
      (sum, o) => sum + (o.quantity || 0),
      0
    );
    const prevActiveCustomers = previousPeriodCustomers.size;

    // Calculate percentage changes
    const revenueChange = roundToTwo(
      prevTotalRevenue > 0
        ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
        : totalRevenue > 0
        ? 100
        : 0
    );

    const ordersChange = roundToTwo(
      prevTotalOrders > 0
        ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100
        : totalOrders > 0
        ? 100
        : 0
    );

    const customersChange = roundToTwo(
      prevActiveCustomers > 0
        ? ((activeCustomers - prevActiveCustomers) / prevActiveCustomers) * 100
        : activeCustomers > 0
        ? 100
        : 0
    );

    // For conversion rate, you might need additional data about visitors
    const averageOrderValue =
      totalOrders > 0 ? roundToTwo(totalRevenue / totalOrders) : 0;
    const prevAverageOrderValue =
      prevTotalOrders > 0 ? roundToTwo(prevTotalRevenue / prevTotalOrders) : 0;
    const aovChange = roundToTwo(
      prevAverageOrderValue > 0
        ? ((averageOrderValue - prevAverageOrderValue) /
            prevAverageOrderValue) *
            100
        : averageOrderValue > 0
        ? 100
        : 0
    );

    // Sales trend by date
    const salesByDate = {};
    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split("T")[0];
      if (!salesByDate[date]) {
        salesByDate[date] = { sales: 0, orders: new Set() };
      }
      salesByDate[date].sales = roundToTwo(
        salesByDate[date].sales + order.totalPrice
      );
      salesByDate[date].orders.add(order.orderId.toString());
    });

    const salesTrend = Object.entries(salesByDate)
      .map(([date, data]) => ({
        date,
        sales: data.sales,
        orders: data.orders.size,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Category distribution (convert to percentages)
    const categoryMap = {};
    orders.forEach((o) => {
      categoryMap[o.category] = roundToTwo(
        (categoryMap[o.category] || 0) + o.totalPrice
      );
    });

    const totalCategorySales = roundToTwo(
      Object.values(categoryMap).reduce((sum, val) => sum + val, 0)
    );
    const categoryDistribution = Object.entries(categoryMap).map(
      ([name, value]) => ({
        name,
        value: roundToTwo(
          totalCategorySales > 0 ? (value / totalCategorySales) * 100 : 0
        ),
      })
    );

    // Top products with actual trend calculation
    const productMap = {};
    orders.forEach((o) => {
      if (!productMap[o.productId]) {
        productMap[o.productId] = {
          productId: o.productId,
          name: o.productName,
          currentSales: 0,
          currentUnits: 0,
          previousSales: 0,
          previousUnits: 0,
        };
      }
      productMap[o.productId].currentSales += o.totalPrice;
      productMap[o.productId].currentUnits += o.quantity;
    });

    // Merge previous period data with current data
    previousProductSales.forEach((item) => {
      if (productMap[item._id]) {
        productMap[item._id].previousSales = item.previousSales;
        productMap[item._id].previousUnits = item.previousUnits;
      }
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.currentSales - a.currentSales)
      .slice(0, 5)
      .map((product) => {
        // Calculate trend based on sales change
        let trend = "stable";
        let salesChange = 0;

        if (product.previousSales > 0) {
          salesChange =
            ((product.currentSales - product.previousSales) /
              product.previousSales) *
            100;

          if (salesChange > 5) {
            trend = "up";
          } else if (salesChange < -5) {
            trend = "down";
          }
        } else if (product.currentSales > 0) {
          // New product with no previous sales
          trend = "up";
          salesChange = 100;
        }

        return {
          productId: product.productId,
          name: product.name,
          sales: roundToTwo(product.currentSales),
          units: product.currentUnits,
          trend: trend,
          salesChange: roundToTwo(salesChange),
        };
      });

    // Recent orders
    const recentOrdersData = orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map((order) => ({
        orderId: `${order.orderNumber}`,
        customer: order.customerName,
        product: order.productName,
        amount: roundToTwo(order.totalPrice),
        status: order.status,
        quantity: order.quantity,
      }));
    console.log({
      summary: {
        totalRevenue,
        totalOrders,
        activeCustomers,
        averageOrderValue,
        comparison: {
          revenueChange,
          ordersChange,
          customersChange,
          aovChange,
        },
      },
      salesTrend,
      categoryDistribution,
      topProducts,
      recentOrders: recentOrdersData,
    });
    return success(
      res,
      {
        summary: {
          totalRevenue,
          totalOrders,
          activeCustomers,
          averageOrderValue,
          comparison: {
            revenueChange,
            ordersChange,
            customersChange,
            aovChange,
          },
        },
        salesTrend,
        categoryDistribution,
        topProducts,
        recentOrders: recentOrdersData,
      },
      "Vendor sales report retrieved successfully."
    );
  } catch (err) {
    console.error("Error in Sales report:", err);
    return serverError(res, err, "Failed to retrieve sales report.");
  }
};
