import { hash } from "bcryptjs";
import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";
import Chat from "../../models/chat/chat.js";
import Message from "../../models/message/message.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import DriverDetail from "../../models/driverDetails/driverDetails.js";
import mongoose, { Types } from "mongoose";
import { ROLES } from "../../utils/constant.js";
import Order from "../../models/order/order.js";
import {
  uploadImage,
  getPresignedImageUrls,
} from "../../services/s3Service.js";

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

export const createChat = async (req, res) => {
  try {
    let { userOneId, userTwoId, orderId, chatType } = req.body;

    // Check if either userOneId or userTwoId is "admin"
    if (userOneId === "admin" || userTwoId === "admin") {
      const adminUser = await User.findOne({ role: 10 });

      if (!adminUser) {
        return res.status(404).json({ message: "Admin user not found" });
      }

      if (userOneId === "admin") userOneId = adminUser._id.toString();
      if (userTwoId === "admin") userTwoId = adminUser._id.toString();
    }

    // Search for existing chat
    let chat = await Chat.findOne({
      $or: [
        { userOneId, userTwoId },
        { userOneId: userTwoId, userTwoId: userOneId },
      ],
      orderId: orderId || null,
    });

    if (!chat) {
      chat = await Chat.create({ userOneId, userTwoId, orderId, chatType });
    }

    return success(res, { chat }, "Chat retrieved successfully.");
  } catch (err) {
    console.error("Error in createChat:", err);
    return serverError(res, err, "Failed to create/retrieve chat.");
  }
};

export const getAllMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId });

    if (!messages || messages.length === 0) {
      return success(res, { messages: [] }, "No messages found for this chat.");
    }
    // console.log("Messages retrieved successfully:", messages);
    return success(res, { messages }, "Chat messages retrieved successfully.");
  } catch (err) {
    console.error("Error in getChatMessages:", err);
    return serverError(res, err, "Failed to retrieve chat messages.");
  }
};

export const getChatUsersByUserId = async (req, res) => {
  try {
    const userId = req.params.userId;
    const search = req.query.search || "";
    const roleFilter = req.query.role ? Number(req.query.role) : null;
    const type = req.query.type || "general";

    console.log(
      "Chat type:",
      type,
      "Role filter:",
      roleFilter,
      "userId:",
      userId
    );

    let chatQuery = {};

    if (type === "general") {
      chatQuery = {
        $or: [{ userOneId: userId }, { userTwoId: userId }],
        chatType: "general",
        orderId: null,
      };
    } else if (type === "order") {
      chatQuery = {
        $or: [{ userOneId: userId }, { userTwoId: userId }],
        chatType: "order",
      };
    }

    const chats = await Chat.find(chatQuery);
    console.log("Found chats:", chats.length);

    if (!chats.length) {
      return success(res, { users: [] }, "No chats found for this user.");
    }

    // Get order IDs for order chats
    const orderIds = chats
      .filter(chat => chat.orderId)
      .map(chat => chat.orderId);

    // Fetch orders to get order numbers
    let ordersMap = new Map();
    if (type === "order" && orderIds.length > 0) {
      const orders = await Order.find({ 
        _id: { $in: orderIds } 
      }).select('_id orderNumber');
      
      orders.forEach(order => {
        ordersMap.set(order._id.toString(), order.orderNumber);
      });
    }

    // ✅ Collect all unique otherUserIds from chats
    const allUserIds = chats.flatMap((chat) => [
      chat.userOneId,
      chat.userTwoId,
    ]);
    const uniqueUserIds = [...new Set(allUserIds)].filter(
      (id) => id !== userId
    );

    console.log("Unique other user IDs to process:", uniqueUserIds);

    const populatedUsers = await Promise.all(
      uniqueUserIds.map(async (otherUserId) => {
        try {
          // 1. Try to find the user in User collection
          let user = await User.findById(otherUserId).lean();
          // console.log(`Processing user ID: ${otherUserId}`, user);
          let role = user?.role ?? ROLES.CUSTOMER;
          let name = "Unknown User";
          let email = user?.email || "unknown@example.com";
          let image = null;

          if (!user) {
            // Not found in User → check detail collections
            const vendorDetail = await VendorDetail.findOne({
              _id: otherUserId,
            }).lean();
            const driverDetail = await DriverDetail.findOne({
              _id: otherUserId,
            }).lean();
            const customerDetail = await CustomerDetail.findOne({
              _id: otherUserId,
            }).lean();

            if (vendorDetail) {
              role = ROLES.VENDOR;
              name =
                vendorDetail.ownerName || vendorDetail.businessName || "Vendor";
              user = await User.findById(vendorDetail.userId).lean();
              email = user?.email;
              if (vendorDetail.profilePicture) {
                const [url] = await getPresignedImageUrls([
                  vendorDetail.profilePicture,
                ]);
                image = url;
              }
            } else if (driverDetail) {
              console.log("Found driver detail:", driverDetail);
              user = await User.findById(driverDetail.userId).lean();
              email = user?.email;
              console.log("Associated user:", user);
              role = ROLES.DRIVER;
              name = driverDetail.FullName || "Driver";
              if (driverDetail.profileImage) {
                const [url] = await getPresignedImageUrls([
                  driverDetail.profileImage,
                ]);
                image = url;
              }
            } else if (customerDetail) {
              role = ROLES.CUSTOMER;
              name = customerDetail.FullName || "Customer";
              user = await User.findById(customerDetail.userId).lean();
              email = user?.email;
              if (customerDetail.profileImage) {
                const [url] = await getPresignedImageUrls([
                  customerDetail.profileImage,
                ]);
                image = url;
              }
            } else {
              console.log(
                `User ${otherUserId} not found in any role detail collection either`
              );
              return null;
            }

            // Build minimal user object
            user = { _id: otherUserId, role, email };
          }

          // 2. Pull profile info depending on role
          switch (role) {
            case ROLES.VENDOR: {
              const vendorProfile = await VendorDetail.findOne({
                userId: user._id,
              }).lean();
              if (vendorProfile) {
                name =
                  vendorProfile.ownerName || vendorProfile.businessName || name;
                if (vendorProfile.profilePicture) {
                  const [url] = await getPresignedImageUrls([
                    vendorProfile.profilePicture,
                  ]);
                  image = url;
                }
              }
              break;
            }
            case ROLES.DRIVER: {
              const driverProfile = await DriverDetail.findOne({
                userId: user._id,
              }).lean();
              console.log("Driver profile:", driverProfile);
              if (driverProfile) {
                name = driverProfile.FullName || name;
                if (driverProfile.profileImage) {
                  const [url] = await getPresignedImageUrls([
                    driverProfile.profileImage,
                  ]);
                  image = url;
                }
              }
              break;
            }
            case ROLES.CUSTOMER: {
              const customerProfile = await CustomerDetail.findOne({
                userId: user._id,
              }).lean();
              if (customerProfile) {
                name = customerProfile.FullName || name;
                if (customerProfile.profileImage) {
                  const [url] = await getPresignedImageUrls([
                    customerProfile.profileImage,
                  ]);
                  image = url;
                }
              }
              break;
            }
          }

          // 3. Find all chats between current user and this user
          const relatedChats = chats.filter(
            (chat) =>
              (chat.userOneId === userId &&
                chat.userTwoId === user._id.toString()) ||
              (chat.userTwoId === userId &&
                chat.userOneId === user._id.toString())
          );

          // 4. Return one record per chat
          return relatedChats.map((chat) => ({
            _id: user._id,
            role,
            name,
            image,
            email, // ✅ always from User if available
            chatId: chat._id,
            orderId: chat.orderId,
            // Add order number for order chats
            orderNumber: type === "order" && chat.orderId 
              ? ordersMap.get(chat.orderId.toString()) || null 
              : null
          }));
        } catch (error) {
          console.error(`Error processing user ${otherUserId}:`, error);
          return null;
        }
      })
    );

    // Flatten and dedupe by chatId
    let filteredUsers = populatedUsers.flat().filter(Boolean);

    const uniqueMap = new Map();
    filteredUsers.forEach((u) => {
      const key = u.chatId.toString();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, u);
      }
    });
    filteredUsers = Array.from(uniqueMap.values());

    // Apply filters
    if (roleFilter !== null && !isNaN(roleFilter)) {
      filteredUsers = filteredUsers.filter((u) => u.role === roleFilter);
    }

    if (search) {
      filteredUsers = filteredUsers.filter((u) =>
        u.name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    return success(
      res,
      { users: filteredUsers },
      "Chat users retrieved successfully."
    );
  } catch (err) {
    console.error("Error in getChatUsersByUserId:", err);
    return serverError(res, err, "Failed to retrieve chat users.");
  }
};
