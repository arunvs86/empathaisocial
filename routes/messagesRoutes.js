const express = require('express');
const router = express.Router();
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const User = require('../schemas/UserSchema');
const Chat = require('../schemas/ChatSchema');

// Middleware for parsing the body (if needed)
router.use(bodyParser.urlencoded({ extended: false }));

router.get("/", (req, res, next) => {
    res.status(200).render("inboxPage", {
        pageTitle: "Inbox",
        userLoggedIn: req.session.user,
        userLoggedInJs: JSON.stringify(req.session.user)
    });
});

router.get("/new", (req, res, next) => {
    res.status(200).render("newMessage", {
        pageTitle: "New message",
        userLoggedIn: req.session.user,
        userLoggedInJs: JSON.stringify(req.session.user)
    });
});

router.get("/:chatId", async (req, res, next) => {
    const userId = req.session.user._id;
    const chatId = req.params.chatId;
    const isValidId = mongoose.isValidObjectId(chatId);

    const payload = {
        pageTitle: "Chat",
        userLoggedIn: req.session.user,
        userLoggedInJs: JSON.stringify(req.session.user)
    };

    if (!isValidId) {
        payload.errorMessage = "Chat does not exist or you do not have permission to view it.";
        return res.status(200).render("chatPage", payload);
    }
    
    
    let chat = await Chat.findOne({ _id: chatId, users: { $elemMatch: { $eq: userId } } })
        .populate("users");

    if (chat == null) {
        // Check if chat id is really user id
        const userFound = await User.findById(chatId);

        if (userFound != null) {
            // get chat using user id
            chat = await getChatByUserId(userFound._id, userId);
        }
    }

    if (chat == null) {
        payload.errorMessage = "Chat does not exist or you do not have permission to view it.";
    } else {
        payload.chat = chat;
    }

    res.status(200).render("chatPage", payload);
});

async function getChatByUserId(userLoggedInId, otherUserId) {
    // Ensure both IDs are of ObjectId type
    otherUserId = new mongoose.Types.ObjectId(otherUserId);

    // First, try to find the chat directly without using upsert to avoid unintentional creation
    let chat = await Chat.findOne({
        isGroupChat: false,
        users: {
            $size: 2,
            $all: [
                { $elemMatch: { $eq: userLoggedInId } },
                { $elemMatch: { $eq: otherUserId } }
            ]
        }
    }).populate("users");

    // If chat exists, return it
    if (chat) {
        return chat;
    }

    // If chat doesn't exist, create a new one
    chat = new Chat({
        isGroupChat: false,
        users: [userLoggedInId, otherUserId]
    });

    await chat.save();
    await chat.populate("users"); // Populate after saving to ensure all user details are fetched

    return chat;
}



module.exports = router;
