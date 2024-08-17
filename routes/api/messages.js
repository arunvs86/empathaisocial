const express = require('express');
const router = express.Router();
const User = require('../../schemas/UserSchema');
const Chat = require('../../schemas/ChatSchema');
const Message = require('../../schemas/MessageSchema');
const Notification = require('../../schemas/NotificationSchema');
const axios = require('axios');
const eventEmitter = require('../../events');  // Import the event emitter

router.post("/", async (req, res, next) => {
    if (!req.body.content || !req.body.chatId) {
        console.log("Invalid data passed into request");
        return res.sendStatus(400);
    }

    try {
        // Find the chat and populate the users
        const chat = await Chat.findById(req.body.chatId).populate('users');
        
        if (!chat) {
            console.log("Chat not found");
            return res.sendStatus(404);
        }

        if (!chat.users) {
            console.log("Chat.users not defined");
            return res.sendStatus(500);
        }

        console.log("Chat Users:", chat.users);  // Log the users in the chat

        // Step 1: Handle storing the user's message
        const requestMessage = {
            sender: req.session.user._id,
            content: req.body.content,
            chat: req.body.chatId
        };

        const savedUserMessage = await Message.create(requestMessage);
        const populatedUserMessage = await savedUserMessage.populate("sender").execPopulate();

        // Update the chat with the latest user message
        await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: populatedUserMessage });

        // Emit the user's message with a fully populated chat object using the event emitter
        eventEmitter.emit('newMessage', { ...populatedUserMessage.toObject(), chat });

        // Step 2: If the chatbot user is part of the chat, handle the chatbot's response
        const chatbotUserId = '66bfd81be2ed4b4ae420dcd6';  // Declare the chatbot user ID here
        const isChatbotUser = chat.users.some(user => user._id.toString() === chatbotUserId);

        if (isChatbotUser) {
            const chatbotResponse = await axios.post('https://empathaiapi-kize6gbndq-nw.a.run.app/api/ask', {
                question: req.body.content,
                session_id: 'session1'
            });

            const botMessage = {
                sender: chatbotUserId,
                content: chatbotResponse.data.answer,
                chat: req.body.chatId
            };

            console.log("Bot Message Data:", botMessage);  // Log the data passed to Message.create

            const savedBotMessage = await Message.create(botMessage);
            const populatedBotMessage = await savedBotMessage.populate("sender").execPopulate();

            // Update the chat with the latest bot message
            await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: populatedBotMessage });

            // Emit the bot's message with a fully populated chat object using the event emitter
            eventEmitter.emit('newMessage', { ...populatedBotMessage.toObject(), chat });

            // Step 3: Send both the user's and bot's messages back to the front-end
            return res.status(201).send({ userMessage: populatedUserMessage, botMessage: populatedBotMessage });
        } else {
            // If the chatbot user is not in the chat, just return the user's message
            return res.status(201).send(populatedUserMessage);
        }
    } catch (error) {
        console.log("Error handling message:", error);
        return res.sendStatus(500);
    }
});

module.exports = router;

