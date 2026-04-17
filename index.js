const QR = require("./models/QR");
const QRCode = require("qrcode");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const archiver = require("archiver");
const Jimp = require("jimp").default;
const path = require("path");

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

/* ================= AUTH ================= */
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

/* ================= QR WITH LOGO ================= */
const generateQRWithLogo = async (url, size = 600) => {
  const qrBuffer = await QRCode.toBuffer(url, {
    width: size,
    margin: 2,
  });

  const qr = await Jimp.read(qrBuffer);

  const logoPath = path.resolve(__dirname, "logo.png");
  const logo = await Jimp.read(logoPath);

  const logoSize = Math.floor(size / 4);
  logo.resize(logoSize, logoSize);

  const x = (qr.bitmap.width - logoSize) / 2;
  const y = (qr.bitmap.height - logoSize) / 2;

  qr.composite(logo, x, y);

  return await qr.getBufferAsync(Jimp.MIME_PNG);
};

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

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, role: user.role });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= CREATE QR ================= */
app.post("/create-qr", authMiddleware, async (req, res) => {
  try {
    const qr = await QR.create({
      ...req.body,
      userId: req.user.userId,
      userEmail: req.user.email,
      isActivated: true,
    });

    res.json(qr);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= BULK CREATE (🔥 FIX ADDED) ================= */
app.post("/bulk-create", authMiddleware, async (req, res) => {
  try {
    const { count } = req.body;

    if (!count || count <= 0) {
      return res.status(400).json({ error: "Invalid count" });
    }

    const user = await User.findById(req.user.userId);
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const qrList = [];

    for (let i = 0; i < count; i++) {
      const qr = await QR.create({
        isActivated: false,
        scans: 0,
        scanHistory: []
      });
      qrList.push(qr);
    }

    res.json({
      message: `${count} QR codes created`,
      data: qrList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk create failed" });
  }
});

/* ================= MY QRS ================= */
app.get("/my-qrs", authMiddleware, async (req, res) => {
  const qrs = await QR.find({ userId: req.user.userId }).sort({ createdAt: -1 });
  res.json(qrs);
});

/* ================= ALL QRS ================= */
app.get("/all-qrs", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const qrs = await QR.find().sort({ createdAt: -1 });
  res.json(qrs);
});

/* ================= GENERATE QR ================= */
app.get("/generate-qr/:id", async (req, res) => {
  try {
    const url = `${BACKEND_URL}/scan/${req.params.id}`;
    const qrImage = await generateQRWithLogo(url, 600);

    res.setHeader("Content-Type", "image/png");
    res.send(qrImage);

  } catch (err) {
    res.status(500).json({ error: "QR generation failed" });
  }
});

/* ================= DOWNLOAD ================= */
app.get("/download-qr/:id/:size", async (req, res) => {
  const size = parseInt(req.params.size) || 6;
  const url = `${BACKEND_URL}/scan/${req.params.id}`;

  const qrImage = await generateQRWithLogo(url, size * 100);

  res.setHeader("Content-Disposition", `attachment; filename=QR-${req.params.id}.png`);
  res.setHeader("Content-Type", "image/png");
  res.send(qrImage);
});

/* ================= BULK DOWNLOAD ================= */
app.get("/download-unassigned/:size", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const size = parseInt(req.params.size) || 6;
  const qrs = await QR.find({ isActivated: false });

  res.attachment(`unassigned-qrs-${size}.zip`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  for (const qr of qrs) {
    const url = `${BACKEND_URL}/scan/${qr._id}`;
    const qrImage = await generateQRWithLogo(url, size * 100);

    archive.append(qrImage, { name: `QR-${qr._id}.png` });
  }

  await archive.finalize();
});

/* ================= SCAN ================= */
app.get("/scan/:id", async (req, res) => {
  const qr = await QR.findById(req.params.id);
  if (!qr) return res.send("Invalid QR ❌");

  qr.scans = (qr.scans || 0) + 1;
  qr.scanHistory = qr.scanHistory || [];

  qr.scanHistory.push({
    device: req.headers["user-agent"] || "Unknown",
    time: new Date(),
  });

  await qr.save();

  return res.redirect(`${FRONTEND_URL}/profile/${qr._id}`);
});

/* ================= QR DATA ================= */
app.get("/qr-data/:id", async (req, res) => {
  const qr = await QR.findById(req.params.id);
  if (!qr) return res.status(404).json({ error: "QR not found" });

  res.json(qr);
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});