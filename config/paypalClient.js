import paypal from "@paypal/checkout-server-sdk";

// ⚡ Use Sandbox for testing
const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);

const paypalClient = new paypal.core.PayPalHttpClient(environment);

export default paypalClient;
