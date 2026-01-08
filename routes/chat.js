import express from "express";
import * as FC from "../controllers/chat/index.js";

const router = express.Router();

router.post("/", FC.createChat);
router.get("/:chatId/messages", FC.getAllMessages);
router.get("/:userId", FC.getChatUsersByUserId);

export default router;
