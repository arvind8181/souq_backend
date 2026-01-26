export const ROLES = {
  CUSTOMER: 1,
  VENDOR: 2,
  DRIVER: 3,
  ADMIN: 10,
  CITY_MANAGER: 11,
  SUPPORT: 12,
  SUB_ADMIN: 13,
};

export const PERMISSIONS = {
  DASHBOARD: 'dashboard',
  VENDORS_VIEW: 'vendors_view',
  VENDORS_MANAGE: 'vendors_manage',
  DRIVERS_VIEW: 'drivers_view',
  DRIVERS_MANAGE: 'drivers_manage',
  ORDERS_VIEW: 'orders_view',
  STORES: 'stores',
  CATEGORY: 'category',
  ADS: 'ads',
  PROMOTIONS: 'promotions',
  REVIEWS: 'reviews',
  CHATS: 'chats',
  DRIVER_COMMISSION: 'driver_commission',
  ADDON_PRICING: 'addon_pricing',
  PROMOTION_PRICING: 'promotion_pricing',
  FINANCES: 'finances',
  DRIVER_PAYMENTS: 'driver_payments',
};

export const S3TYPE = {
  PRODUCT: "img/product",
  REVIEW: "img/review",
  DRIVER: "img/driver/doc",
  VENDOR: "img/vendor",
  ADVERTISEMENT: "img/advertisement",
  PROFILE: "img/profile",
};
export const ORDERTYPE = {
  "15_min": 1,
  "marketplace": 2,
};
export const COLORS = {
  PRIMARY: "#1a1d24",
  WHITE: "#ffffff",
  TEXT_DARK: "#1a1d24",
  BACKGROUND_LIGHT: "#f5f5f5", // Light background for contrast
};
export const ResponseMessage = {
  SUCCESS: "Request successful!",
  FAILED: "Request Failed!",
  USER_EXIST: "User already exist!",
  USER_CREATED: "User account created successfully!",
  TOKEN_EXPIRED: "Token has been expired!",
  INVALID_CREDENTIALS: "Invalid credentials!",
  INVALID_REQUEST: "Invalid request!",
  FORGOT_EMAIL_SENT: "Please check your email to reset the password!",
  INVITATION_MAIL_SENT: "Invitation mail sent successfully!",
  ACCOUNT_DEACTIVE:
    "Your account is inactive. Please contact SurveyHub support team for more information!",
  PASSWORD_RESET_SUCCESS: "Password reset successful!",
  SOMETHING_WENT_WRONG: "Something went wrong!",
  NOTIFICATION_READ: "Notification marked as read successfully!",
  UNAUTHORIZED: "Unauthorized access!",
  USER_NOT_FOUNT: "User not found!",
  LOGIN_SUCCESS: "Login successfully!",
  SERVER_ERROR: "Internal server error!",
  DATA_FETCHED: "Data fetched successfully!",
  DATA_NOT_FOUND: "Data not found!",
  DATA_UPDATED: "Data updated successfully!",
  DATA_CREATED: "Data created successfully!",
  DATA_EXIST: "Data already exist!",
  BAD_REQUEST: "Bad request - Invalid input!",
  UNAUTHORIZED_ACCESS: "Unauthorized - Missing or invalid token!",
  DATA_DELETED: "Data deleted successfully!",
  ACCESS_DENIED:
    "Access denied - Dont't have permission to access this module!",
  FORBIDDEN: "Forbidden!",
  CONFLICT: "409 Conflict!",
  VALIDATION_FAILED: "Vlidation failed!",
};
export const CATEGORY_OPTIONS = [
  "Food & Beverage",
  "Clothing & Accessories",
  "Electronics & Mobile Phones",
  "Home Appliances & Furniture",
  "Health & Beauty",
  "Pharmacy & Medical Supplies",
  "Books & Stationery",
  "Construction Materials & Tools",
  "Automotive & Spare Parts",
  "Supermarkets & Groceries",
  "Handicrafts & Traditional Goods",
  "Tailoring & Textiles",
  "IT & Computer Services",
  "Agricultural Products",
  "Hardware & Electrical Supplies",
  "Bakery & Sweets",
  "Restaurants & Cafes",
  "Gold & Jewelry",
  "Laundry & Cleaning Services",
  "Other",
];
export const categories = [
  {
    name: "Paramedical",
    subcategories: [
      "First Aid",
      "Pain Relief",
      "Orthopaedic Supports",
      "Thermometers & Devices",
      "Health Supplements",
      "Diabetes Care",
      "Respiratory Devices",
      "Mobility Aids",
      "Skin Treatments",
    ],
  },
  {
    name: "Grocery",
    subcategories: [
      "Fruits & Vegetables",
      "Dairy & Bakery",
      "Snacks & Branded Foods",
      "Beverages",
      "Staples",
      "Household Essentials",
      "Personal Care",
      "Baby Care",
      "Instant & Frozen Food",
      "Dry Fruits & Nuts",
      "Cleaning Supplies",
    ],
  },
  {
    name: "Clothes",
    subcategories: [
      "Men's Clothing",
      "Women's Clothing",
      "Kids' Clothing",
      "T-Shirts & Polos",
      "Shirts",
      "Jeans & Trousers",
      "Shorts & Track Pants",
      "Ethnic Wear",
      "Winter Wear",
      "Innerwear & Sleepwear",
      "Sportswear",
      "Dresses & Skirts",
      "Sarees & Kurtis",
      "Jackets & Coats",
      "Sweaters & Hoodies",
      "Suits & Blazers",
      "Maternity Wear",
      "Accessories (Belts, Ties, Scarves)",
      "Rainwear",
    ],
  },
];

export const CATEGORY_ENUM = categories.map((cat) => cat.name);

export const SUBCATEGORY_ENUM = categories
  .flatMap((cat) => cat.subcategories)
  .filter((v, i, arr) => arr.indexOf(v) === i);

export const ratingsSchema = {
  1: { type: Number, default: 0 },
  2: { type: Number, default: 0 },
  3: { type: Number, default: 0 },
  4: { type: Number, default: 0 },
  5: { type: Number, default: 0 },
  overall: { type: Number, default: 0 },
};
