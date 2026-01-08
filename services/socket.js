import { Server } from "socket.io";
import {
  sendSocketMessage,
  updateDriverLocation,
  getNotification,
  handleMarkAsRead,
  handleGetDriverLocation,
  handleGetVendorOrderDetails,
  handleGetActiveDeliveringDrivers,
} from "../helpers/socket.js";

const green = "\x1b[32m";
const reset = "\x1b[0m";
const red = "\x1b[31m";

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  console.log("**************************************");
  console.log(`${green}*    Socket.IO server initialized${reset}`);
  console.log("**************************************");

  io.on("connection", (socket) => {
    console.log(`${green}User connected:${reset}`, socket.id);

    socket.on("joinRoom", ({ chatId }) => {
      socket.join(chatId);
    });

    socket.on("sendMessage", async (payload) => {
      await sendSocketMessage(payload, io);
    });
    socket.on("getNotification", async (payload) => {
      await sendSocketMessage(payload, io);
    });
    socket.on("leaveRoom", ({ chatId }) => {
      socket.leave(chatId);
      console.log(`Socket ${socket.id} left room ${chatId}`);
    });

    // ✅ Call reusable helper
    socket.on("driverLocation", async ({ token, latitude, longitude }) => {
      await updateDriverLocation(token, latitude, longitude);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
    socket.on("getNotification", async (payload) => {
      await getNotification(payload, io);
    });

    socket.on("markNotificationRead", async (payload) => {
      await handleMarkAsRead(payload, io);
    });

    socket.on("getNotification", (payload) => getNotification(socket, payload));

    socket.on("getDriverLocation", (payload) =>
      handleGetDriverLocation(socket, payload)
    );

    socket.on("getVendorOrderDetails", (payload) =>
      handleGetVendorOrderDetails(socket, payload)
    );
    socket.on("getActiveDeliveringDrivers", () =>
      handleGetActiveDeliveringDrivers(socket)
    );
  });
};
