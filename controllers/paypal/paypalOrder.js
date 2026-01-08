import paypalClient from "../../config/paypalClient.js";
import paypal from "@paypal/checkout-server-sdk";
import Order from "../../models/order/order.js";

// Create PayPal Order
export const createPaypalOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order._id.toString(),
          amount: {
            currency_code: "USD",
            value: order.grandTotal.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `http://localhost:5000/success?orderId=${order._id}`,
        cancel_url: `http://localhost:5000/cancel?orderId=${order._id}`,
      },
    });

    const response = await paypalClient.execute(request);

    return res.status(200).json({
      success: true,
      id: response.result.id,
      links: response.result.links,
    });
  } catch (error) {
    console.error("PayPal Create Order Error:", error);
    return res.status(500).json({ success: false, message: "PayPal order creation failed" });
  }
};


// Capture PayPal Order
export const capturePaypalOrder = async (req, res) => {
  try {
    const { paypalOrderId, orderId } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});

    const response = await paypalClient.execute(request);

    if (response.result.status === "COMPLETED") {
      await Order.findByIdAndUpdate(orderId, {
        "vendors.$[].paymentStatus": "paid",
      });

      return res.status(200).json({
        success: true,
        message: "Payment captured successfully",
        data: response.result,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Payment not completed",
      data: response.result,
    });
  } catch (error) {
    console.error("PayPal Capture Error:", error);
    return res.status(500).json({ success: false, message: "PayPal capture failed" });
  }
};
