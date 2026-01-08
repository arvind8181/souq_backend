import Notification from "../models/notification/notification.js";

/**
 * Create a new notification
 */
export const createNotification = async ({
  userId,
  refId,
  title,
  message,
  type = "info",
}) => {
  try {
    const notification = new Notification({
      userId,
      refId,
      title,
      message,
      type,
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Mark one or multiple notifications as read
 */
export const markAsRead=async (notificationIds, userId) =>{
  try {
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds }, userId },
      { $set: { isRead: true } }
    );
    return result;
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    throw error;
  }
}

