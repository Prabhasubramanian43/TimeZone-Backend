const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const transporter = require("../config/mailer");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

const ADMIN_EMAIL = "prabhasubramanian35@gmail.com";

// ======================================
// SEND CUSTOMER AND ADMIN ORDER EMAILS
// ======================================

async function sendOrderEmails(order) {
  const productDetails = order.products
    .map(
      (product) => `${product.name} - ₹${product.price} x ${product.quantity}`,
    )
    .join("\n");

  const customerMail = {
    from: process.env.SMTP_EMAIL,
    to: order.email,
    subject: "TIMEZONE - Order Confirmation",
    text: `
Hello ${order.customerName},

Your order has been placed successfully!

Order Details:

${productDetails}

Total Amount: ₹${order.totalAmount}
Payment Method: ${order.paymentMethod}
Order Status: ${order.orderStatus}

Thank you for shopping with TIMEZONE Watches!
`,
  };

  const adminMail = {
    from: process.env.SMTP_EMAIL,
    to: ADMIN_EMAIL,
    subject: "TIMEZONE - New Customer Order",
    text: `
New order received!

Customer Name: ${order.customerName}
Email: ${order.email}
Phone: ${order.phone}
Address: ${order.address}

Products:
${productDetails}

Total Amount: ₹${order.totalAmount}
Payment Method: ${order.paymentMethod}
Order Status: ${order.orderStatus}
`,
  };

  const results = await Promise.allSettled([
    transporter.sendMail(customerMail),
    transporter.sendMail(adminMail),
  ]);

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.log("Order email error:", result.reason);
    }
  });
}

// ======================================
// GET - ALL ORDERS FOR ADMIN
// ======================================

router.get("/all", adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      totalOrders: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get all orders error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch all orders.",
    });
  }
});

// ======================================
// GET - ORDER STATISTICS
// ======================================

router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();

    const revenueResult = await Order.aggregate([
      {
        $match: {
          orderStatus: { $ne: "Cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$totalAmount",
          },
        },
      },
    ]);

    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    res.status(200).json({
      success: true,
      totalOrders,
      totalRevenue,
    });
  } catch (error) {
    console.error("Order statistics error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch order statistics.",
    });
  }
});

// ======================================
// POST - CREATE NEW ORDER
// ======================================

router.post("/", async (req, res) => {
  try {
    const {
      userId,
      customerName,
      email,
      phone,
      address,
      products,
      totalAmount,
      paymentMethod,
    } = req.body;

    if (
      !userId ||
      !customerName ||
      !email ||
      !phone ||
      !address ||
      !products ||
      !Array.isArray(products) ||
      products.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required order details.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const formattedProducts = products.map((product) => {
      const item = {
        name: product.name,
        price: Number(product.price),
        image: product.image || "",
        quantity: Number(product.quantity),
      };

      if (
        product.productId &&
        mongoose.Types.ObjectId.isValid(product.productId)
      ) {
        item.productId = product.productId;
      }

      return item;
    });

    const validProducts = formattedProducts.every(
      (product) =>
        product.name &&
        Number.isFinite(product.price) &&
        product.price >= 0 &&
        Number.isInteger(product.quantity) &&
        product.quantity > 0,
    );

    if (!validProducts) {
      return res.status(400).json({
        success: false,
        message: "Invalid product details.",
      });
    }

    const calculatedTotal = formattedProducts.reduce(
      (total, product) => total + product.price * product.quantity,
      0,
    );

    if (
      !Number.isFinite(Number(totalAmount)) ||
      Number(totalAmount) !== calculatedTotal
    ) {
      return res.status(400).json({
        success: false,
        message: "Order total does not match product total.",
      });
    }

    const newOrder = new Order({
      userId,
      customerName,
      email,
      phone,
      address,
      products: formattedProducts,
      totalAmount: calculatedTotal,
      paymentMethod: paymentMethod || "Cash on Delivery",
      orderStatus: "Order Placed",
    });

    const savedOrder = await newOrder.save();

    // Send emails without interrupting successful order placement
    await sendOrderEmails(savedOrder);

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Create order error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to place order.",
    });
  }
});

// ======================================
// GET - CUSTOMER ORDERS
// ======================================

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const orders = await Order.find({ userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      totalOrders: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get customer orders error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch customer orders.",
    });
  }
});

// ======================================
// PUT - UPDATE ORDER STATUS
// ======================================

router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    const allowedStatuses = [
      "Order Placed",
      "Confirmed",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    if (!allowedStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status.",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { orderStatus },
      { new: true, runValidators: true },
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully!",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update order error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update order status.",
    });
  }
});

// ======================================
// DELETE - DELETE ORDER
// ======================================

router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully!",
    });
  } catch (error) {
    console.error("Delete order error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete order.",
    });
  }
});

module.exports = router;
