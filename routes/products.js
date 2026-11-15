const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

function validateProduct(body) {
  const required = [
    "name",
    "brand",
    "category",
    "type",
    "description",
    "image",
  ];
  for (const key of required) {
    if (typeof body[key] !== "string" || !body[key].trim()) {
      return `${key} is required`;
    }
  }
  if (!Number.isFinite(Number(body.price)) || Number(body.price) < 0) {
    return "price must be a valid non-negative number";
  }
  return null;
}

// GET /api/products?search=casio&category=Men&brand=Titan
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.category)
      filter.category = new RegExp(
        `^${String(req.query.category).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      );
    if (req.query.brand)
      filter.brand = new RegExp(
        `^${String(req.query.brand).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      );
    if (req.query.type)
      filter.type = new RegExp(
        `^${String(req.query.type).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      );
    if (req.query.search) {
      const safe = String(req.query.search).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      filter.$or = ["name", "brand", "category", "type", "description"].map(
        (key) => ({ [key]: new RegExp(safe, "i") }),
      );
    }
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    console.error("GET products:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to fetch products" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Unable to fetch product" });
  }
});

// POST /api/products — add a product
router.post("/", adminAuth, async (req, res) => {
  const validationError = validateProduct(req.body);
  if (validationError)
    return res.status(400).json({ success: false, message: validationError });
  try {
    const product = await Product.create({
      name: req.body.name.trim(),
      brand: req.body.brand.trim(),
      category: req.body.category.trim(),
      type: req.body.type.trim(),
      description: req.body.description.trim(),
      image: req.body.image.trim(),
      price: Number(req.body.price),
    });
    res
      .status(201)
      .json({ success: true, message: "Product added successfully", product });
  } catch (error) {
    console.error("POST product:", error);
    res.status(500).json({ success: false, message: "Unable to add product" });
  }
});

// PUT /api/products/:id — update product fields
router.put("/:id", adminAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  const validationError = validateProduct(req.body);
  if (validationError)
    return res.status(400).json({ success: false, message: validationError });
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name.trim(),
        brand: req.body.brand.trim(),
        category: req.body.category.trim(),
        type: req.body.type.trim(),
        description: req.body.description.trim(),
        image: req.body.image.trim(),
        price: Number(req.body.price),
      },
      { new: true, runValidators: true },
    );
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("PUT product:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to update product" });
  }
});

// DELETE /api/products/:id
router.delete("/:id", adminAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.json({
      success: true,
      message: "Product deleted successfully",
      productId: product._id,
    });
  } catch (error) {
    console.error("DELETE product:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to delete product" });
  }
});

module.exports = router;
