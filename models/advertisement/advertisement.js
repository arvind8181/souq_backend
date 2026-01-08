import mongoose from "mongoose";

const advertisementSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomerDetail",
        required: true
    },
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number },
    negotiable: { type: Boolean, default: false },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    location: { type: String },
    images: { type: [String], default: [] },
    reported: { type: Boolean, default: false },

    // 🆕 Moderation Fields
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
    rejectionReason: {
        type: String
    },

    category: {
        type: String,
        enum: ["real_estate", "car", "used_item"],
        required: true
    },
    agent: {
        type: String,
        enum: ["Private Owner", "Real Estate Agent", "Company"]
    },

    //  Real Estate Fields
    realEstate_adType: { type: String, enum: ["Sell", "Rent"] },
    realEstate_propertyType: {
        type: String,
        enum: [
            "Apartment", "House-Villa", "Land - Residential",
            "Land - Agricultural", "Land - Commercial",
            "Commercial Store", "Office", "Warehouse", "Building"
        ]
    },
    realEstate_condition: {
        type: String,
        enum: [
            "Normal", "On Skeleton",
            "Destroyed (Partially Restorable)",
            "Destroyed (Completely Unrestorable)"
        ]
    },
    realEstate_sizeM2: { type: Number },
    realEstate_bedrooms: { type: Number },
    realEstate_bathrooms: { type: Number },
    realEstate_balconies: { type: Number },
    realEstate_floorNumber: { type: Number },
    realEstate_totalFloors: { type: Number },
    realEstate_parkingAvailable: { type: Boolean },
    realEstate_elevator: { type: Boolean },
    realEstate_furnishing: {
        type: String,
        enum: ["Furnished", "Semi", "Unfurnished"]
    },
    realEstate_amenities: [{
        type: String,
        enum: [
            "AC", "Heating", "Internet", "Satellite", "Storage",
            "Generator Access", "Solar for Water Heating",
            "Solar for Electricity", "Swimming Pool", "Grill Area"
        ]
    }],
    realEstate_constructionYear: { type: Number },
    realEstate_legalPaperwork: {
        type: String,
        enum: ["Available", "Under Process", "Missing"]
    },
    realEstate_rentalType: { type: String, enum: ["Short-Term", "Long-Term"] },
    realEstate_monthlyRent: { type: Number },
    realEstate_paymentFrequency: {
        type: String,
        enum: ["Monthly", "Yearly", "Other"]
    },
    realEstate_cleaningServices: {
        type: String,
        enum: ["Yes", "No", "On Demand"]
    },
    realEstate_hotWater: { type: Boolean },
    realEstate_utilitiesIncluded: {
        electricity: { type: Boolean },
        water: { type: Boolean },
        internet: { type: Boolean }
    },

    //  Car Fields
    car_adType: { type: String, enum: ["Sell", "Rent"] },
    car_make: { type: String },
    car_modelName: { type: String },
    car_modelYear: { type: Number },
    car_yearOfManufacture: { type: Number },
    car_engineCapacityCC: { type: Number },
    car_fuelType: {
        type: String,
        enum: ["Petrol", "Diesel", "Hybrid", "Electric"]
    },
    car_transmission: { type: String, enum: ["Manual", "Automatic"] },
    car_bodyShape: {
        type: String,
        enum: ["Sedan", "SUV", "Coupe", "Truck", "Hatchback", "Van"]
    },
    car_drivetrain: { type: String, enum: ["FWD", "RWD", "AWD"] },
    car_colorExterior: { type: String },
    car_colorInterior: { type: String },
    car_kilometersDriven: { type: Number },
    car_condition: {
        type: String,
        enum: ["Excellent", "Good", "Needs Work"]
    },
    car_hasAccidents: { type: String, enum: ["Yes", "No", "Minor"] },
    car_tiresCondition: {
        type: String,
        enum: ["New", "Good", "Needs Replacement"]
    },
    car_features: [{
        type: String,
        enum: [
            "AC", "Bluetooth", "ABS", "Airbags", "Navigation",
            "Rear Camera", "Sunroof", "Remote Start", "Keyless Entry"
        ]
    }],
    car_insurance: { type: Boolean },
    car_licenseStatus: {
        type: String,
        enum: ["No", "Valid", "Expired"]
    },
    car_customsTaxesPaid: { type: Boolean },
    car_spareKey: { type: Boolean },

    // Used Item Fields
    usedItem_category: {
        type: String,
        enum: [
            "Electronics", "Furniture", "Appliances", "Clothing", "Books",
            "Tools", "Home Décor", "Baby & Kids", "Vehicles",
            "Sports Equipment", "Miscellaneous"
        ]
    },
    usedItem_subcategory: { type: String },
    usedItem_brand: { type: String },
    usedItem_warrantyRemaining: { type: Boolean },
    usedItem_condition: {
        type: String,
        enum: ["New", "Like New", "Good", "Used", "Not Working"]
    },
    usedItem_quantity: { type: Number },
    usedItem_availableAccessories: [{ type: String }],

    // Contact Preferences
    contactPreferences_preferredMethod: {
        type: String,
        enum: ["Call", "Chat", "WhatsApp"]
    },
    contactPreferences_preferredTime: { type: String }
}, { timestamps: true });

const Advertisement = mongoose.model('Advertisement', advertisementSchema);
export default Advertisement;
