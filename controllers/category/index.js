import Category from "../../models/category/category.js";
import JsonRes from "../../helpers/response.js";
import { ResponseMessage } from "../../utils/constant.js";




// CREATE CATEGORY
export const createCategory = async (req, res) => {
    try {
        const { category, subCategory, color, commission } = req.body;

        // Validation
        if (!category || category.trim() === "") {
            return JsonRes.badRequest(res, null, "Category name is required");
        }
        if (!isValidSubCategoryArray(subCategory)) {
            return JsonRes.badRequest(res, null, "Subcategory must be a non-empty array of strings");
        }
        if (commission !== undefined && (isNaN(commission) || commission < 0)) {
            return JsonRes.badRequest(res, null, "Commission must be a positive number");
        }
        if (color !== undefined && typeof color !== "boolean") {
            return JsonRes.badRequest(res, null, "Color must be true or false");
        }

        // Check for duplicate category name
        const exists = await Category.findOne({ category: category.trim() });
        if (exists) {
            return JsonRes.conflict(res, null, "This category already exists");
        }

        const newCategory = await Category.create({
            category: category.trim(),
            subCategory: subCategory.map((s) => s.trim()),
            color,
            commission,
        });

        return JsonRes.success(res, newCategory, ResponseMessage.DATA_CREATED);
    } catch (error) {
        console.error("Error creating category:", error);
        return JsonRes.serverError(res, null, error.message);
    }
};

// UPDATE CATEGORY
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, subCategory, color, commission } = req.body;

        // Check if category exists
        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return JsonRes.notFound(res, null, "Category not found");
        }

        // Validation
        if (subCategory !== undefined && !isValidSubCategoryArray(subCategory)) {
            return JsonRes.badRequest(res, null, "Subcategory must be a non-empty array of strings");
        }
        if (commission !== undefined && (isNaN(commission) || commission < 0)) {
            return JsonRes.badRequest(res, null, "Commission must be a positive number");
        }
        if (color !== undefined && typeof color !== "boolean") {
            return JsonRes.badRequest(res, null, "Color must be true or false");
        }

        // Check for duplicate category name (exclude current doc)
        if (category) {
            const duplicate = await Category.findOne({
                _id: { $ne: id },
                category: category.trim(),
            });
            if (duplicate) {
                return JsonRes.conflict(res, null, "Another category with the same name already exists");
            }
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            {
                ...req.body,
                category: category?.trim(),
                subCategory: subCategory?.map((s) => s.trim()),
            },
            { new: true, runValidators: true }
        );

        return JsonRes.success(res, updatedCategory, ResponseMessage.DATA_UPDATED);
    } catch (error) {
        console.error("Error updating category:", error);
        return JsonRes.serverError(res, null, error.message);
    }
};

// GET ALL CATEGORIES (with pagination)
export const getAllCategories = async (req, res) => {
    try {
        const { page = 1, pageSize = 10, search } = req.query;
        const skip = (page - 1) * pageSize;
        const filter = {};
        if (search) {
            const searchRegex = new RegExp(search, "i");
            filter.$or = [{ category: searchRegex }, { subCategory: { $in: [searchRegex] } }];
        }
        const categories = await Category.find(filter)
            .skip(skip)
            .limit(parseInt(pageSize));
        const totalRecords = await Category.countDocuments(filter);
        return JsonRes.success(
            res,
            {
                data: categories,
                totalRecords,
                currentPage: parseInt(page),
                pageSize: parseInt(pageSize),
            },
            ResponseMessage.DATA_FETCHED
        );
    } catch (error) {
        console.error("Error fetching categories:", error);
        return JsonRes.serverError(res, null, error.message);
    }
};

// GET CATEGORY BY ID
export const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);
        if (!category) {
            return JsonRes.notFound(res, null, "Category not found");
        }

        return JsonRes.success(res, category, ResponseMessage.DATA_FETCHED);
    } catch (error) {
        console.error("Error fetching category by ID:", error);
        return JsonRes.serverError(res, null, error.message);
    }
};

// DELETE CATEGORY
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedCategory = await Category.findByIdAndDelete(id);
        if (!deletedCategory) {
            return JsonRes.notFound(res, null, "Category not found");
        }

        return JsonRes.success(res, deletedCategory, ResponseMessage.DATA_DELETED);
    } catch (error) {
        console.error("Error deleting category:", error);
        return JsonRes.serverError(res, null, error.message);
    }
};


// Helper: Validate subCategory array
const isValidSubCategoryArray = (value) => {
    return Array.isArray(value) && value.length > 0 && value.every(
        (item) => typeof item === "string" && item.trim() !== ""
    );
};
