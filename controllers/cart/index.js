import Cart from "../../models/cart/cart.js";
import Product from "../../models/product/products.js";
import Favorite from "../../models/favourite/favourite.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import JsonRes from "../../helpers/response.js";
import { getPresignedImageUrls } from "../../services/s3Service.js";

const { badRequest, success, serverError, notFound } = JsonRes;

// Add to Cart
export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return badRequest(res, null, "Items array is required.");
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        subTotal: 0,
        shippingFee: 0,
        grandTotal: 0,
      });
    }

    for (const { productId, quantity = 1 } of items) {
      const product = await Product.findById(productId);
      if (!product) {
        return notFound(res, null, `Product with ID ${productId} not found.`);
      }

      if (!product.isAvailable || product.deleted) {
        return badRequest(res, null, `Product ${product.productName} is not available.`);
      }

      const vendorId = product.vendorId;

      // Get price - use discountedprice if exists, else fallback to price
      const effectivePrice = product.discountedprice ?? product.price;

      const existingItem = cart.items.find(
        (item) => item.productId.toString() === productId
      );

      const existingQuantity = existingItem ? existingItem.quantity : 0;
      const totalRequestedQuantity = existingQuantity + quantity;

      if (totalRequestedQuantity > product.quantity) {
        return badRequest(
          res,
          null,
          `You can only add up to ${product.quantity} units of ${product.productName}.`
        );
      }

      if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.price = effectivePrice;
        existingItem.totalPrice = existingItem.quantity * effectivePrice;
      } else {
        cart.items.push({
          productId,
          vendorId,
          quantity,
          price: effectivePrice,
          totalPrice: effectivePrice * quantity,
        });
      }
    }

    cart.subTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    const uniqueVendors = new Set(cart.items.map((item) => item.vendorId.toString()));
    cart.shippingFee = uniqueVendors.size === 1 ? 1 : 2;

    cart.grandTotal = cart.subTotal + cart.shippingFee;

    // Add totalItems count
    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    await cart.save();

    return success(res, cart, "Products added to cart successfully.");
  } catch (err) {
    console.error("addToCart error:", err);
    return serverError(res, err, "Failed to add products to cart.");
  }
};

// Update Cart Item Quantity
export const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    if (!productId || quantity == null) {
      return badRequest(res, null, "productId and quantity are required.");
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) return notFound(res, null, "Cart not found.");

    const item = cart.items.find((i) => i.productId.toString() === productId);
    if (!item) return notFound(res, null, "Product not found in cart.");

    const product = await Product.findById(productId);
    if (!product) return notFound(res, null, "Product does not exist.");

    if (quantity > product.quantity) {
      return badRequest(
        res,
        null,
        `You can only add up to ${product.quantity} units of ${product.productName}.`
      );
    }

    // Get price - use discountedprice if exists, else fallback to price
    const effectivePrice = product.discountedprice ?? product.price;

    item.quantity = quantity;
    item.price = effectivePrice;
    item.totalPrice = item.quantity * effectivePrice;

    cart.subTotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    const uniqueVendors = new Set(cart.items.map((i) => i.vendorId.toString()));
    cart.shippingFee = uniqueVendors.size === 1 ? 1 : 2;
    cart.grandTotal = cart.subTotal + cart.shippingFee;

    // Add totalItems count
    cart.totalItems = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    await cart.save();

    return success(res, cart, "Cart updated successfully.");
  } catch (err) {
    console.error("updateCartItemQuantity error:", err);
    return serverError(res, err, "Failed to update cart item quantity.");
  }
};

// Get Cart
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get customerId from userId
    const customer = await CustomerDetail.findOne({ userId });
    if (!customer) {
      return JsonRes.notFound(res, null, "Customer not found.");
    }
    const customerId = customer._id;

    const cart = await Cart.findOne({ userId })
      .populate(
        "items.productId",
        "productName price discountedprice images productType"
      );

    if (!cart) {
      return JsonRes.success(res, {
        items: [],
        totalItems: 0,
        subTotal: 0,
        shippingFee: 0,
        grandTotal: 0,
      }, "Cart is empty.");
    }

    const plainCart = cart.toObject();

    // Get all favorite product IDs for this customer
    const favoriteProductIds = await Favorite.find({ customerId }).distinct(
      "productId"
    );

    // Process images + favourites
    await Promise.all(
      plainCart.items.map(async (item) => {
        if (item.productId?.images?.length) {
          item.productId.images = await getPresignedImageUrls(
            item.productId.images
          );
        }
        const isFav = favoriteProductIds.some(
          (favId) => favId.toString() === item.productId._id.toString()
        );
        item.productId.isFavourite = isFav;
      })
    );

    // Add totalItems count for entire cart
    plainCart.totalItems = plainCart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    // Calculate overall cart subtotal
    plainCart.subTotal = plainCart.items.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    );

    // Calculate overall shipping fee based on unique vendors
    const overallVendors = new Set(
      plainCart.items.map((item) => item.vendorId?.toString())
    );
    plainCart.shippingFee = overallVendors.size > 1 ? 2 : 1;

    // Calculate overall grand total
    plainCart.grandTotal = plainCart.subTotal + plainCart.shippingFee;

    // Group items by productType with per-group totals
    const groupedMap = new Map();
    plainCart.items.forEach((item) => {
      const type = item.productId?.productType || "unknown";
      if (!groupedMap.has(type)) {
        groupedMap.set(type, []);
      }
      groupedMap.get(type).push(item);
    });

    plainCart.items = Array.from(groupedMap, ([productType, products]) => {
      const totalItems = products.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      const subTotal = products.reduce(
        (sum, item) => sum + (item.totalPrice || 0),
        0
      );

      // Vendor-based shipping fee for this group
      const uniqueVendors = new Set(
        products.map((item) => item.vendorId?.toString())
      );
      const shippingFee = uniqueVendors.size > 1 ? 2 : 1;

      const grandTotal = subTotal + shippingFee;

      return {
        productType,
        products,
        totalItems,
        subTotal,
        shippingFee,
        grandTotal,
      };
    });

    return JsonRes.success(res, plainCart, "Cart fetched successfully.");
  } catch (err) {
    console.error("getCart error:", err);
    return JsonRes.serverError(res, err, "Failed to fetch cart.");
  }
};





// Delete Cart Item
export const deleteCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId) {
      return JsonRes.badRequest(res, null, "Product ID is required.");
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return JsonRes.notFound(res, null, "Cart not found.");
    }

    const updatedItems = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );

    if (updatedItems.length === cart.items.length) {
      return JsonRes.notFound(res, null, "Product not found in cart.");
    }

    cart.items = updatedItems;

    cart.subTotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    const uniqueVendors = new Set(cart.items.map((i) => i.vendorId.toString()));
    cart.shippingFee = uniqueVendors.size === 1 ? 1 : 2;
    cart.grandTotal = cart.subTotal + cart.shippingFee;

    // Add totalItems count
    cart.totalItems = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    await cart.save();

    return JsonRes.success(res, cart, "Product removed from cart successfully.");
  } catch (err) {
    console.error("deleteCartItem error:", err);
    return JsonRes.serverError(res, err, "Failed to remove product from cart.");
  }
};
