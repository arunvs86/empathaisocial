const express = require('express');
const router = express.Router();
const bodyParser = require("body-parser");
const User = require('../../schemas/UserSchema');
const Chat = require('../../schemas/ChatSchema');
const Message = require('../../schemas/MessageSchema');
const Notification = require('../../schemas/NotificationSchema');
const axios = require('axios');
const eventEmitter = require('../../events');  // Importing the EventEmitter

router.use(bodyParser.urlencoded({ extended: false }));

router.post("/", async (req, res, next) => {
    if (!req.body.content || !req.body.chatId) {
        console.log("Invalid data passed into request");
        return res.sendStatus(400);
    }

    // Fetch the chat to determine if the message is for the chatbot
    const chat = await Chat.findById(req.body.chatId).populate("users").catch(error => {
        console.log(error);
        return res.sendStatus(400);
    });

    if (!chat) {
        console.log("Chat not found");
        return res.sendStatus(404);
    }

    const chatbotUserId = '66c0e43216afe09f3843f8cc';  // Declare the chatbot user ID here
    const isChatbotUser = chat.users.some(user => user._id.toString() === chatbotUserId);

    if (isChatbotUser) {
        try {
            // Create a new message for the user's input
            var newMessage = {
                sender: req.session.user._id,
                content: req.body.content,
                chat: req.body.chatId
            };

            // Save the user's message
            let message = await Message.create(newMessage);
            message = await message.populate("sender");
            message = await message.populate("chat");
            message = await User.populate(message, { path: "chat.users" });

            // Emit the user's message event
            eventEmitter.emit("newMessage", message);

            // Call the chatbot API
            const chatbotResponse = await axios.post('https://empathaiapi-kize6gbndq-nw.a.run.app/api/ask', {
                question: req.body.content,
                session_id: 'session1'  // Use a session ID for context if needed
            });

            // Create a new message for the chatbot's response
            var botMessage = {
                sender: chatbotUserId,  // The chatbot is the sender
                content: chatbotResponse.data.answer,  // Assuming this is where the response is
                chat: req.body.chatId
            };

            // Save the chatbot's response message
            let chatbotMessage = await Message.create(botMessage);
            chatbotMessage = await chatbotMessage.populate("sender");
            chatbotMessage = await chatbotMessage.populate("chat");
            chatbotMessage = await User.populate(chatbotMessage, { path: "chat.users" });

            // Update the chat's latest message with the bot's response
            await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: chatbotMessage }).catch(error => console.log(error));

            // Emit the bot's message event
            eventEmitter.emit("newMessage", chatbotMessage);

            // Send notifications for both messages
            insertNotifications(chat, message);
            insertNotifications(chat, chatbotMessage);

            // Send both the user's message and bot's message back to the client
            res.status(201).send({ userMessage: message, botMessage: chatbotMessage });
        } catch (error) {
            console.log("Error interacting with chatbot API:", error);
            return res.sendStatus(500);
        }
    } else {
        // Existing logic for handling normal user messages
        var newMessage = {
            sender: req.session.user._id,
            content: req.body.content,
            chat: req.body.chatId
        };

        Message.create(newMessage)
            .then(async message => {
                message = await message.populate("sender");
                message = await message.populate("chat");
                message = await User.populate(message, { path: "chat.users" });

                // Update the chat's latest message
                await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message })
                    .catch(error => console.log(error));

                // Emit the message event
                eventEmitter.emit("newMessage", message);

                // Send notifications for the message
                insertNotifications(chat, message);

                res.status(201).send(message);
            })
            .catch(error => {
                console.log(error);
                res.sendStatus(400);
            });
    }
});

function insertNotifications(chat, message) {
    chat.users.forEach(userId => {
        if (userId == message.sender._id.toString()) return;

        Notification.insertNotification(userId, message.sender._id, "newMessage", message.chat._id);
    });
}

module.exports = router;
