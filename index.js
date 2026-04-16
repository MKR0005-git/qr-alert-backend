const QR = require("./models/QR");
const QRCode = require("qrcode");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const PDFDocument = require("pdfkit");

require("dotenv").config();

const app = express();

/* ================= CONFIG ================= */
const FRONTEND_URL = "https://qr-alert-frontend.vercel.app";
const BACKEND_URL = "https://qr-alert-backend.onrender.com";

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(cors());

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log(err));

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

/* ================= GOOGLE LOGIN ================= */
app.post("/google-login", async (req, res) => {
  try {
    const { email, name } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        name,
        role: email === "kedhareswar5555@gmail.com" ? "admin" : "user",
      });
    }

    if (email === "kedhareswar5555@gmail.com") {
      user.role = "admin";
      await user.save();
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, role: user.role });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= CREATE QR ================= */
app.post("/create-qr", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // 🔥 FIX
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const qr = await QR.create({
      ...req.body,
      userId: decoded.userId,
      userEmail: decoded.email,
      isActivated: true,
    });

    res.json({ id: qr._id });

  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

/* ================= BULK CREATE ================= */
app.post("/bulk-create", async (req, res) => {
  try {
    const { count } = req.body;

    const qrs = [];

    for (let i = 0; i < count; i++) {
      const qr = await QR.create({
        name: "UNASSIGNED",
        phone: "NA",
        bloodGroup: "NA",
        emergencyContact: "NA",
        emergencyEmail: "",
        isActivated: false,
      });

      qrs.push(qr);
    }

    res.json(qrs);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= ACTIVATE QR ================= */
app.post("/activate-qr/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // 🔥 FIX
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const qr = await QR.findById(req.params.id);

    if (!qr) return res.status(404).json({ error: "QR not found" });

    if (qr.isActivated) {
      return res.status(400).json({ error: "Already activated" });
    }

    const updated = await QR.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        userId: decoded.userId,
        userEmail: decoded.email,
        isActivated: true,
      },
      { new: true }
    );

    res.json(updated);

  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

/* ================= USER QRS ================= */
app.get("/my-qrs", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // 🔥 FIX
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const data = await QR.find({
      userId: decoded.userId,
    }).sort({ createdAt: -1 });

    res.json(data);

  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

/* ================= DOWNLOAD ================= */
app.get("/download-qr/:id/:size", async (req, res) => {
  try {
    const { id, size } = req.params;

    const sizes = { "6": 226, "8": 302, "12": 454 };
    const pixelSize = sizes[size] || 300;

    const url = `${BACKEND_URL}/scan/${id}`;

    const qr = await QRCode.toDataURL(url, {
      width: pixelSize,
      margin: 2,
    });

    const buffer = Buffer.from(qr.split(",")[1], "base64");

    res.set("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= SCAN ================= */
app.get("/scan/:id", async (req, res) => {
  try {
    const data = await QR.findById(req.params.id);

    if (!data) return res.status(404).send("Not found");

    data.scans += 1;

    data.scanHistory.push({
      time: new Date(),
      device: req.headers["user-agent"] || "Unknown",
    });

    await data.save();

    if (!data.isActivated) {
      return res.redirect(`${FRONTEND_URL}/activate/${req.params.id}`);
    }

    res.redirect(`${FRONTEND_URL}/profile/${req.params.id}`);

  } catch {
    res.status(500).send("Error");
  }
});

/* ================= OTHER ROUTES ================= */
app.get("/qr-data/:id", async (req, res) => {
  const data = await QR.findById(req.params.id);
  res.json(data);
});

app.get("/generate-qr/:id", async (req, res) => {
  try {
    const url = `${BACKEND_URL}/scan/${req.params.id}`;
    const qr = await QRCode.toDataURL(url);
    const buffer = Buffer.from(qr.split(",")[1], "base64");

    res.set("Content-Type", "image/png");
    res.send(buffer);

  } catch {
    res.status(500).json({ error: "QR generation failed" });
  }
});

app.get("/all-qrs", async (req, res) => {
  const qrs = await QR.find().sort({ createdAt: -1 });
  res.json(qrs);
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});