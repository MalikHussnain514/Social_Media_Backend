const User = require("../models/User");
const Post = require("../models/Post");
const { sendEmail } = require("../middlewares/sendEmail");
const crypto = require("crypto");

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "User Already Exists",
      });
    }

    user = await User.create({
      name,
      email,
      password,
      avatar: { public_id: "sample_id", url: "sample_url" },
    });

    const token = await user.generateToken();

    const options = {
      expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    };

    res
      .status(201)
      .cookie("token", token, options)
      .json({ success: true, user, token });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User does not exist",
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect Password" });
    }

    const token = await user.generateToken();

    const options = {
      expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    };

    res
      .status(200)
      .cookie("token", token, options)
      .json({ success: true, user, token });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    res
      .status(200)
      .cookie("token", null, { expires: new Date(Date.now()), httpOnly: true })
      .json({ success: true, message: "Logged Out" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.followUser = async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id);
    const loggedInUser = await User.findById(req.user._id);

    if (!userToFollow) {
      return res
        .status(404)
        .json({ success: false, message: "User Not Found" });
    }

    if (loggedInUser.following.includes(userToFollow._id)) {
      const indexFollowing = loggedInUser.following.indexOf(userToFollow._id);
      const indexFollowers = userToFollow.followers.indexOf(loggedInUser._id);

      loggedInUser.following.splice(indexFollowing, 1);
      userToFollow.followers.splice(indexFollowers, 1);

      await loggedInUser.save();
      await userToFollow.save();
      return res
        .status(200)
        .json({ success: true, message: "User UnFollowed" });
    } else {
      loggedInUser.following.push(userToFollow._id);
      userToFollow.followers.push(loggedInUser._id);

      await loggedInUser.save();
      await userToFollow.save();

      return res.status(200).json({ success: true, message: "User Followed" });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+password");

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide old and new password",
      });
    }

    const isMatch = await user.matchPassword(oldPassword);

    if (!isMatch) {
      return res
        .status(404)
        .json({ success: false, message: "Incorrect Old Password" });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: "Password Updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const { name, email } = req.body;

    if (name) {
      user.name = name;
    }
    if (email) {
      user.email = email;
    }

    // user avatar

    await user.save();

    res.status(200).json({ success: true, message: "Profile Updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const posts = user.posts;
    const followers = user.followers;
    const following = user.following;
    const userId = user._id;

    await user.deleteOne();

    //logout user after deleting profile

    res.cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    });

    // deleting all posts of user
    for (let i = 0; i < posts.length; i++) {
      const post = await Post.findById(posts[i]);
      await post.deleteOne();
    }

    // removing user from follower's following
    for (let i = 0; i < followers.length; i++) {
      const follower = await User.findById(followers[i]);

      const index = follower.following.indexOf(userId);
      follower.following.splice(index, 1);
      await follower.save();
    }

    // removing user from following's followers
    for (let i = 0; i < following.length; i++) {
      const follows = await User.findById(following[i]);

      const index = follows.followers.indexOf(userId);
      follows.followers.splice(index, 1);
      await follows.save();
    }

    res.status(200).json({ success: true, message: "Profile Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.myProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("posts");

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate("posts");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User Not Found" });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    // Retrieve the page and per_page query parameters
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    // Retrieve the search query parameter
    const search = req.query.search || "";

    // Create a regular expression to match names starting with the search query
    const nameRegex = new RegExp(`^${search}`, "i");

    // Calculate the skip value based on the page and per_page values
    const skip = (page - 1) * perPage;

    const users = await User.find({ name: nameRegex })
      .skip(skip)
      .limit(perPage);

    const count = await User.countDocuments();

    const totalPages = Math.ceil(count / perPage);

    res.status(200).json({
      success: true,
      users,
      totalNumberOfUsers: count,
      CurrentPage: page,
      TotalNumberOfPages: totalPages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ success: true, message: "User Not Found" });
    }

    const resetPasswordToken = await user.getResetPasswordToken();

    await user.save();

    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/password/reset/${resetPasswordToken}`;

    const message = `Reset your password by clicking on the link below: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Reset Password",
        message,
      });

      res
        .status(200)
        .json({ success: true, message: `Email sent to ${user.email}` });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save();

      res.status(500).json({ success: false, message: error.message });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Token is invalid or has been expired",
      });
    }

    user.password = req.body.password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ success: true, message: "Password Updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
