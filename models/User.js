const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true, // ✅ avoid duplicate users
  },

  name: {
    type: String,
  },

  // 🔥 ADD ROLE SYSTEM
  role: {
    type: String,
    enum: ["user", "admin"], // ✅ restrict values
    default: "user",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);