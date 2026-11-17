const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const transporter = require("../config/mailer");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "prabhasubramanian35@gmail.com";

// ======================================
// SEND CUSTOMER AND ADMIN ORDER EMAILS
// ======================================

async function sendOrderEmails(order) {
  const productDetails = order.products
    .map(
      (product) =>
        `${product.name} - ₹${product.price} x ${product.quantity}`,
    )
    .join("\n");

  const sender = `"TIMEZONE Watches" <${process.env.SMTP_EMAIL}>`;

  const customerMail = {
    from: sender,
    to: order.email,
    subject: "TIMEZONE - Order Confirmation",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #333;">
        <h2 style="color: #b8860b;">TIMEZONE Watches</h2>

        <h3>Order Confirmed!</h3>

        <p>Hello ${order.customerName},</p>

        <p>Your order has been placed successfully.</p>

        <h3>Order Details</h3>

        <p><strong>Order ID:</strong> ${order._id}</p>

        <p><strong>Products:</strong></p>

        <pre>${productDetails}</pre>

        <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>

        <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>

        <p><strong>Order Status:</strong> ${order.orderStatus}</p>

        <p>Thank you for shopping with TIMEZONE Watches!</p>

        <h3>Happy Shopping!</h3>
      </div>
    `,
  };

  const adminMail = {
    from: sender,
    to: ADMIN_EMAIL,
    subject: "TIMEZONE - New Customer Order",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #333;">
        <h2 style="color: #b8860b;">New Order Received!</h2>

        <h3>Order Details</h3>

        <p><strong>Order ID:</strong> ${order._id}</p>

        <p><strong>Customer Name:</strong> ${order.customerName}</p>

        <p><strong>Email:</strong> ${order.email}</p>

        <p><strong>Phone:</strong> ${order.phone}</p>

        <p><strong>Address:</strong> ${order.address}</p>

        <p><strong>Products:</strong></p>

        <pre>${productDetails}</pre>

        <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>

        <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>

        <p><strong>Order Status:</strong> ${order.orderStatus}</p>
      </div>
    `,
  };

  const results = await Promise.allSettled([
    transporter.sendMail(customerMail),
    transporter.sendMail(adminMail),
  ]);

  const customerResult = results[0];
  const adminResult = results[1];

  if (customerResult.status === "fulfilled") {
    console.log(
      "Customer order email sent:",
      customerResult.value.messageId,
    );
  } else {
    console.error("Customer order email failed:", customerResult.reason);
  }

  if (adminResult.status === "fulfilled") {
    console.log(
      "Admin order email sent:",
      adminResult.value.messageId,
    );
  } else {
    console.error("Admin order email failed:", adminResult.reason);
  }
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
      (total, product) =>
        total + product.price * product.quantity,
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
      email: email.trim().toLowerCase(),
      phone,
      address,
      products: formattedProducts,
      totalAmount: calculatedTotal,
      paymentMethod: paymentMethod || "Cash on Delivery",
      orderStatus: "Order Placed",
    });

    // Save order first
    const savedOrder = await newOrder.save();

    console.log("New order created:", savedOrder._id);

    // Send customer and admin emails
    try {
      await sendOrderEmails(savedOrder);
    } catch (emailError) {
      console.error("Order email sending error:", emailError);
    }

    return res.status(201).json({
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
// SEND CUSTOMER EMAIL
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

    const existingOrder = await Order.findById(id);

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const previousStatus = existingOrder.orderStatus;

    existingOrder.orderStatus = orderStatus;

    const updatedOrder = await existingOrder.save();

    // Send customer status update email only if status changes
    if (previousStatus !== orderStatus) {
      try {
        await transporter.sendMail({
          from: `"TIMEZONE Watches" <${process.env.SMTP_EMAIL}>`,
          to: updatedOrder.email,
          subject: `TIMEZONE - Order ${orderStatus}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 25px; color: #333;">

              <h2 style="color: #b8860b;">TIMEZONE Watches</h2>

              <h3>Order Status Update</h3>

              <p>Hello ${updatedOrder.customerName},</p>

              <p>Your order status has been updated successfully.</p>

              <h3>Order Details</h3>

              <p>
                <strong>Order ID:</strong>
                ${updatedOrder._id}
              </p>

              <p>
                <strong>Previous Status:</strong>
                ${previousStatus}
              </p>

              <p>
                <strong>Current Status:</strong>
                ${orderStatus}
              </p>

              <p>
                <strong>Total Amount:</strong>
                ₹${updatedOrder.totalAmount}
              </p>

              <p>
                Thank you for shopping with TIMEZONE Watches!
              </p>

            </div>
          `,
        });

        console.log(
          "Order status email sent successfully:",
          updatedOrder.email,
          orderStatus,
        );
      } catch (emailError) {
        console.error("Order status email failed:", emailError);
      }
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