const QR = require("./models/QR");
const QRCode = require("qrcode");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const archiver = require("archiver");
const Jimp = require("jimp");
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

/* ================= 🔥 QR WITH LOGO (FIXED) ================= */
const generateQRWithLogo = async (url, size = 600) => {
  try {
    const qrBuffer = await QRCode.toBuffer(url, {
      width: size,
      margin: 2,
    });

    const qr = await Jimp.read(qrBuffer);

    const logoPath = path.resolve(__dirname, "logo.png");
    console.log("Loading logo from:", logoPath);

    const logo = await Jimp.read(logoPath);

    const logoSize = size / 4;
    logo.resize(logoSize, logoSize);

    const x = (qr.bitmap.width - logoSize) / 2;
    const y = (qr.bitmap.height - logoSize) / 2;

    qr.composite(logo, x, y);

    return await qr.getBufferAsync(Jimp.MIME_PNG);

  } catch (err) {
    console.error("QR ERROR FULL:", err);
    throw err;
  }
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

/* ================= ALL QRS ================= */
app.get("/all-qrs", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const qrs = await QR.find().sort({ createdAt: -1 });

    res.json(qrs);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= QR DATA ================= */
app.get("/qr-data/:id", async (req, res) => {
  try {
    const qr = await QR.findById(req.params.id);

    if (!qr) return res.status(404).json({ error: "QR not found" });

    res.json(qr);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= GENERATE QR ================= */
app.get("/generate-qr/:id", async (req, res) => {
  try {
    const url = `${BACKEND_URL}/scan/${req.params.id}`;
    const qrImage = await generateQRWithLogo(url, 600);

    res.setHeader("Content-Type", "image/png");
    res.send(qrImage);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= DOWNLOAD ================= */
app.get("/download-qr/:id/:size", async (req, res) => {
  try {
    const size = parseInt(req.params.size) || 6;
    const url = `${BACKEND_URL}/scan/${req.params.id}`;

    const qrImage = await generateQRWithLogo(url, size * 100);

    res.setHeader("Content-Disposition", `attachment; filename=QR-${req.params.id}.png`);
    res.setHeader("Content-Type", "image/png");
    res.send(qrImage);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= BULK DOWNLOAD ================= */
app.get("/download-unassigned/:size", authMiddleware, async (req, res) => {
  try {
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

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= DELETE ================= */
app.delete("/delete-qr/:id", authMiddleware, async (req, res) => {
  const qr = await QR.findById(req.params.id);

  if (!qr) return res.status(404).json({ error: "QR not found" });

  if (qr.userId && qr.userId.toString() !== req.user.userId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await QR.findByIdAndDelete(req.params.id);

  res.json({ message: "QR deleted" });
});

/* ================= SCAN ================= */
app.get("/scan/:id", async (req, res) => {
  const data = await QR.findById(req.params.id);

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
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});