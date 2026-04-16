const mongoose = require("mongoose");

const qrSchema = new mongoose.Schema({
  /* 👤 OWNER (OPTIONAL UNTIL ACTIVATION) */
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  /* 🔥 ADD THIS (IMPORTANT FOR DEBUG + FUTURE) */
  userEmail: {
    type: String,
    default: null,
  },

  /* 🧾 BASIC INFO */
  name: {
    type: String,
    default: "UNASSIGNED",
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

  /* 🔥 EMERGENCY EMAIL */
  emergencyEmail: {
    type: String,
    default: "",
    match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"], // ✅ fixes your error
  },

  /* 🔥 ACTIVATION */
  isActivated: {
    type: Boolean,
    default: false,
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