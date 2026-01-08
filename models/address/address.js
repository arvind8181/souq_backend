import { Schema, model, Types } from "mongoose";

const AddressSchema = new Schema(
    {
        userId: {
            type: Types.ObjectId,
            ref: "User",
            required: true,
        },
        label: {
            type: String,
            enum: ["Home", "Office", "Other"],
            default: "Home",
        },
        buildingNo: {
            type: String,
            required: true,
            trim: true,
        },
        apartmentNo: {
            type: String,
            required: true,
            trim: true,
        },
        floorNo: {
            type: String,
            required: true,
            trim: true,
        },
        street: {
            type: String,
            trim: true
        },
        city: {
            type: String,
            trim: true
        },
        landmark: {
            type: String,
            trim: true
        },
        pincode: {
            type: String,
            trim: true
        },
        phone: {
            type: String,
            trim: true,
        },
        coordinates: {
            latitude: { type: Number, required: false },
            longitude: { type: Number, required: false },
        },
        isDefault: { type: Boolean, default: false },
    },
    { timestamps: true }
);

AddressSchema.index({ userId: 1, isDefault: -1 });

const Address = model("Address", AddressSchema);
export default Address;
