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
const FRONTEND_URL = "http://192.168.1.2:5173";

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
      { userId: user._id },
      "secretkey",
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
    const token = req.headers.authorization;
    const decoded = jwt.verify(token, "secretkey");

    const qr = await QR.create({
      ...req.body,
      userId: decoded.userId,
      isActivated: false,
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
    const token = req.headers.authorization;
    const decoded = jwt.verify(token, "secretkey");

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
        isActivated: true,
      },
      { new: true }
    );

    res.json(updated);

  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

/* ================= 🔥 DOWNLOAD SINGLE QR (SIZE) ================= */
app.get("/download-qr/:id/:size", async (req, res) => {
  try {
    const { id, size } = req.params;

    const sizes = {
      "6": 226,
      "8": 302,
      "12": 454,
    };

    const pixelSize = sizes[size] || 300;

    const url = `http://192.168.1.2:5000/scan/${id}`;

    const qr = await QRCode.toDataURL(url, {
      width: pixelSize,
      margin: 2,
    });

    const img = qr.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(img, "base64");

    res.set("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= 🔥 DOWNLOAD ALL QRs (PDF) ================= */
app.get("/download-all-qrs/:size", async (req, res) => {
  try {
    const { size } = req.params;

    const sizes = {
      "6": 120,
      "8": 160,
      "12": 220,
    };

    const qrSize = sizes[size] || 120;

    const qrs = await QR.find();

    const doc = new PDFDocument({ margin: 20 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=qrs-${size}.pdf`);

    doc.pipe(res);

    let x = 20;
    let y = 20;

    for (let qr of qrs) {
      const url = `http://192.168.1.2:5000/scan/${qr._id}`;
      const qrImage = await QRCode.toDataURL(url);

      const buffer = Buffer.from(
        qrImage.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );

      doc.image(buffer, x, y, { width: qrSize });

      x += qrSize + 20;

      if (x > 500) {
        x = 20;
        y += qrSize + 40;
      }

      if (y > 700) {
        doc.addPage();
        x = 20;
        y = 20;
      }
    }

    doc.end();

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

    res.redirect(`${FRONTEND_URL}/profile/${req.params.id}`);

  } catch {
    res.status(500).send("Error");
  }
});

/* ================= QR DATA ================= */
app.get("/qr-data/:id", async (req, res) => {
  const data = await QR.findById(req.params.id);
  res.json(data);
});

/* ================= QR IMAGE ================= */
app.get("/generate-qr/:id", async (req, res) => {
  try {
    const url = `http://192.168.1.2:5000/scan/${req.params.id}`;

    const qr = await QRCode.toDataURL(url);

    const img = qr.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(img, "base64");

    res.set("Content-Type", "image/png");
    res.send(buffer);

  } catch {
    res.status(500).json({ error: "QR generation failed" });
  }
});

/* ================= USER QRS ================= */
app.get("/my-qrs", async (req, res) => {
  const token = req.headers.authorization;
  const decoded = jwt.verify(token, "secretkey");

  const data = await QR.find({ userId: decoded.userId })
    .sort({ createdAt: -1 });

  res.json(data);
});

/* ================= ALL QRS ================= */
app.get("/all-qrs", async (req, res) => {
  const qrs = await QR.find().sort({ createdAt: -1 });
  res.json(qrs);
});

/* ================= ADMIN STATS ================= */
app.get("/admin-analytics", async (req, res) => {
  const token = req.headers.authorization;
  const decoded = jwt.verify(token, "secretkey");

  const user = await User.findById(decoded.userId);

  if (user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const qrs = await QR.find();

  res.json({
    totalQR: qrs.length,
    totalScans: qrs.reduce((s, q) => s + q.scans, 0),
    activeQR: qrs.filter(q => q.isActivated).length,
  });
});

/* ================= SERVER ================= */
app.listen(5000, () => {
  console.log("Server running on port 5000 🚀");
});