const mongoose = require("mongoose");

const qrSchema = new mongoose.Schema({
  /* 👤 OWNER (OPTIONAL UNTIL ACTIVATION) */
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null, // 🔥 FIXED (was required)
  },

  /* 🧾 BASIC INFO */
  name: {
    type: String,
    default: "UNASSIGNED", // 🔥 allow blank QR
  },

  phone: {
    type: String,
    default: "NA",
  },

  bloodGroup: {
    type: String,
    default: "NA",
  },

  emergencyContact: {
    type: String,
    default: "NA",
  },

  /* 🔥 EMERGENCY EMAIL (OPTIONAL INITIALLY) */
  emergencyEmail: {
    type: String,
    default: "", // 🔥 FIXED (was required)
  },

  /* 🔥 ACTIVATION */
  isActivated: {
    type: Boolean,
    default: false, // 🔥 VERY IMPORTANT (was true)
  },

  /* 📊 SCANS */
  scans: {
    type: Number,
    default: 0,
  },

  /* 🧠 SCAN HISTORY */
  scanHistory: [
    {
      time: {
        type: Date,
        default: Date.now,
      },
      location: {
        type: String,
        default: "Unknown",
      },
      device: {
        type: String,
        default: "Unknown",
      },
    },
  ],

  /* 🕒 CREATED */
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("QR", qrSchema);