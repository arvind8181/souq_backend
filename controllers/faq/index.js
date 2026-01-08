import FaqSchema from "../../models/faq/faq.js";
import JsonRes from "../../helpers/response.js";
const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  notFound,
  unauthorized,
} = JsonRes;

// Add a new FAQ
export const add = async (req, res) => {
  try {
    const faq = new FaqSchema(req.body);
    await faq.save();
    return dataCreated(res, faq);
  } catch (error) {
    return badRequest(res, error);
  }
};

// Update a FAQ
export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (!payload || (!payload.question && !payload.answer)) {
      return res.status(400).json({ status: false, error: "At least one field (question or answer) is required." });
    }

    const updatedFaq = await FaqSchema.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updatedFaq) {
      return res.status(404).json({ status: false, error: "FAQ not found" });
    }

    return res.status(200).json({ status: true, data: updatedFaq });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    if (!res.headersSent) {
      return res.status(500).json({ status: false, error: "Internal Server Error" });
    }
  }
};

// Get all FAQs
export const get = async (req, res) => {
  try {
    const search = req.query.search || "";
    const faqs = await FaqSchema.find({
      $or: [
        { question: new RegExp(search, "i") },
        { answer: new RegExp(search, "i") },
      ],
    }).sort({ createdAt: -1 });
    return success(res, faqs);
  } catch (error) {
    return serverError(res, error);
  }
};


// Delete a FAQ
export const remove = async (req, res) => {
  try {
    const faq = await FaqSchema.findByIdAndDelete(req.params.id);
    if (!faq) {
      return notFound(res);
    }
    return success(res, faq);
  } catch (error) {
    return serverError(res, error);
  }
};

