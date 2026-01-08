import Order from "../../models/order/order.js";
import DriverDetail from "../../models/driverDetails/driverDetails.js";
import { DriverCashLedger } from "../../models/driverCashLedger/driverCashLedger.js";
import JsonRes from "../../helpers/response.js";
const {
  success,
  badRequest,
  notFound,
  serverError
} = JsonRes;



export const updateCashCollection = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const userId = req.user.id;
    console.log("Driver token userId:", userId);

    if (!orderId) {
      return badRequest(res, null, "orderId is required.");
    }

    // Find driverDetails by userId
    const driver = await DriverDetail.findOne({ userId });
    if (!driver) return notFound(res, null, "Driver not found.");

    console.log("Driver _id from driverDetails:", driver._id.toString());

    const order = await Order.findById(orderId);
    if (!order) return notFound(res, null, "Order not found.");

    console.log("Order legs:");
    order.legs.forEach(l => {
      console.log({
        sequence: l.sequence,
        driverId: l.driverId ? l.driverId.toString() : undefined,
        status: l.status
      });
    });

    // Find the leg assigned to this driver
    const leg = order.legs.find(
      (l) => l.driverId && l.driverId.toString() === driver._id.toString() && l.status === "delivered"
    );

    if (!leg) {
      console.log("No matching leg found for this driver.");
      return badRequest(res, null, "No valid delivery leg found for this driver.");
    }

    // Use grandTotal if amount not provided
    const collectAmount = amount || order.grandTotal;
    console.log("Amount to collect:", collectAmount);

    // Create driver cash ledger entry
    const ledgerEntry = new DriverCashLedger({
      driverId: driver._id,
      orderId: order._id,
      amountCollected: collectAmount,
      transactionType: "credit",
      source: "cash_collection",
      date: new Date(),
    });

    await ledgerEntry.save();

    // Mark cash collected in all vendor blocks
    order.vendors.forEach(v => {
      v.cashCollected = true;
      v.cashCollectedAmount = collectAmount;
      v.cashCollectedAt = new Date();
    });

    await order.save();

    // Update driver's cash-in-hand
    driver.cashInHand = (driver.cashInHand || 0) + collectAmount;
    await driver.save();

    return success(
      res,
      { order, ledgerEntry },
      "Cash collection recorded and driver ledger updated."
    );

  } catch (err) {
    console.error("Error updating driver cash collection:", err);
    return serverError(res, err, "Failed to update driver cash collection.");
  }
};


// getDriverLedger
export const getDriverCashLedger = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search = "" } = req.query;

    // Base filter: only debit + paid_to_admin
    const query = {
      transactionType: "debit",
      source: "paid_to_admin",
    };

    // Optional search by orderId or driverId
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { driverId: { $regex: search, $options: "i" } },
      ];
    }

    const total = await DriverCashLedger.countDocuments(query);

    const list = await DriverCashLedger.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(parseInt(pageSize))
      .populate("driverId", "FullName mobileNumber")
      .lean();

    return success(res, { list, total, page, pageSize }, "Driver ledger fetched");
  } catch (err) {
    console.error("Error fetching driver cash ledger:", err);
    return serverError(res, err, "Failed to fetch driver cash ledger.");
  }
};


// driverPaysToAdmin
export const driverPaysToAdmin = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const userId = req.user.id; // Driver token

    if (!orderId || !amount) {
      return badRequest(res, null, "orderId and amount are required.");
    }

    // Find driver
    const driver = await DriverDetail.findOne({ userId });
    if (!driver) return notFound(res, null, "Driver not found.");

    // Find the credit ledger entry for this order
    const creditEntry = await DriverCashLedger.findOne({
      driverId: driver._id,
      orderId,
      transactionType: "credit",
      source: "cash_collection",
    });

    if (!creditEntry) {
      return badRequest(res, null, "No cash collected for this order yet.");
    }

    // Check if the driver is trying to pay more than collected
    if (amount > creditEntry.amountCollected) {
      return badRequest(res, null, "Payment amount exceeds collected cash for this order.");
    }

    // Create a debit ledger entry for the payment to admin
    const ledgerEntry = new DriverCashLedger({
      driverId: driver._id,
      orderId,
      amountCollected: amount,
      transactionType: "debit", // debit for money paid to admin
      source: "paid_to_admin",
      date: new Date(),
      status: "pending", // pending admin approval
    });

    await ledgerEntry.save();

    return success(
      res,
      { ledgerEntry },
      "Payment recorded. Waiting for admin approval."
    );

  } catch (err) {
    console.error("Error recording driver payment to admin:", err);
    return serverError(res, err, "Failed to record driver payment.");
  }
};


// adminApproveDriverPayment
export const adminApproveDriverPayment = async (req, res) => {
  try {
    const { ledgerId } = req.body;

    if (!ledgerId) return badRequest(res, null, "ledgerId is required.");

    // Find ledger entry
    const ledgerEntry = await DriverCashLedger.findById(ledgerId);
    if (!ledgerEntry) return notFound(res, null, "Ledger entry not found.");

    // Only approve if pending and transaction is paid_to_admin
    if (ledgerEntry.source !== "paid_to_admin" || ledgerEntry.status !== "pending") {
      return badRequest(res, null, "Ledger entry cannot be approved.");
    }

    ledgerEntry.status = "approved";
    ledgerEntry.approvedAt = new Date();
    await ledgerEntry.save();

    return success(res, { ledgerEntry }, "Driver payment approved successfully.");
  } catch (err) {
    console.error("Error approving driver payment:", err);
    return serverError(res, err, "Failed to approve driver payment.");
  }
};
