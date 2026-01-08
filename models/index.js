// models/index.js
import { Sequelize } from "sequelize";
import db from "../db/index.js";
import orderModel from "./orders/order.js";

const { sequelize } = db;
const models = {};
models.sequelize = sequelize;
models.order = orderModel(sequelize, Sequelize.DataTypes);

export default models;
