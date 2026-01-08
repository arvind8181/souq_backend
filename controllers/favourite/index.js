import Favorite from "../../models/favourite/favourite.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import Product from "../../models/product/products.js";
import Advertisement from "../../models/advertisement/advertisement.js";
import JsonRes from "../../helpers/response.js";
import {
    getPresignedImageUrls,
} from "../../services/s3Service.js";





//  Add to Favorites...
export const addFavorite = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const customer = await CustomerDetail.findOne({ userId });
    if (!customer) {
      return JsonRes.notFound(res, null, "Customer not found");
    }

    let favoriteData = {};
    let itemType = "";

    // Check if item is a Product
    const product = await Product.findById(itemId);
    if (product) {
      const existing = await Favorite.findOne({
        customerId: customer._id,
        productId: itemId,
      });
      if (existing) {
        return JsonRes.conflict(res, null, "Product already in favorites");
      }
      favoriteData.productId = itemId;
      itemType = "Product";
    } else {
      // Else check if item is an Advertisement
      const advertisement = await Advertisement.findById(itemId);
      if (advertisement) {
        const existing = await Favorite.findOne({
          customerId: customer._id,
          advertisementId: itemId,
        });
        if (existing) {
          return JsonRes.conflict(res, null, "Advertisement already in favorites");
        }
        favoriteData.advertisementId = itemId;
        itemType = "Advertisement";
      } else {
        return JsonRes.notFound(res, null, "Item not found");
      }
    }

    favoriteData.customerId = customer._id;
    const favorite = new Favorite(favoriteData);
    await favorite.save();

    return JsonRes.dataCreated(res, favorite, `${itemType} added to favorites`);
  } catch (err) {
    console.error("Error adding favorite:", err);
    return JsonRes.serverError(res, err.message);
  }
};


// Get Favorites
export const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const customer = await CustomerDetail.findOne({ userId });
    if (!customer) {
      return JsonRes.notFound(res, null, "Customer not found");
    }

    const rawFavorites = await Favorite.find({ customerId: customer._id })
      .populate("productId", "productName price images discountedprice discount")
      .populate("advertisementId", "title description images")
      .sort({ createdAt: -1 });

    // Process each favorite for full image URLs and rename fields
    const favorites = await Promise.all(
      rawFavorites.map(async (fav) => {
        const plainFav = fav.toObject();

        // Rename productId -> product
        if (plainFav.productId) {
          if (plainFav.productId.images?.length) {
            plainFav.productId.images = await getPresignedImageUrls(plainFav.productId.images);
          }
          plainFav.product = plainFav.productId; // rename
          delete plainFav.productId;             // remove old key
        }

        // Rename advertisementId -> advertisement
        if (plainFav.advertisementId) {
          if (plainFav.advertisementId.images?.length) {
            plainFav.advertisementId.images = await getPresignedImageUrls(plainFav.advertisementId.images);
          }
          plainFav.advertisement = plainFav.advertisementId; // rename
          delete plainFav.advertisementId;                   // remove old key
        }

        return plainFav;
      })
    );

    return JsonRes.success(res, favorites, "Favorites fetched successfully");
  } catch (err) {
    console.error("Error fetching favorites:", err);
    return JsonRes.serverError(res, err.message);
  }
};


//  Remove from Favorites...
export const removeFavorite = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const customer = await CustomerDetail.findOne({ userId });
    if (!customer) {
      return JsonRes.notFound(res, null, "Customer not found");
    }

    // Try removing as Product
    let removed = await Favorite.findOneAndDelete({
      customerId: customer._id,
      productId: itemId,
    });

    if (!removed) {
      // If not found, try removing as Advertisement
      removed = await Favorite.findOneAndDelete({
        customerId: customer._id,
        advertisementId: itemId,
      });
    }

    if (!removed) {
      return JsonRes.notFound(res, null, "Item not found in favorites");
    }

    return JsonRes.success(res, null, "Removed from favorites");
  } catch (err) {
    console.error("Error removing favorite:", err);
    return JsonRes.serverError(res, err.message);
  }
};
