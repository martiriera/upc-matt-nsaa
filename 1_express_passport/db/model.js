const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

userSchema.pre(
  // Pre-hook to hash pwd before saving it on the db
  "save",
  function (next) {
    const user = this;
    const hash = bcrypt.hash(this.password, 12);
    this.password = hash;
    next(); // Move to next middleware
  }
);

userSchema.methods.isValidPassword = function (password) {
  const user = this;
  const compare = bcrypt.compare(password, user.password);
  return compare;
};

const UserModel = mongoose.model("user", userSchema);

module.exports = UserModel;
