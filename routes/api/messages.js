// const express = require('express');
// const app = express();
// const router = express.Router();
// const bodyParser = require("body-parser");
// const User = require('../../schemas/UserSchema');
// const Post = require('../../schemas/PostSchema');
// const Chat = require('../../schemas/ChatSchema');
// const Message = require('../../schemas/MessageSchema');
// const Notification = require('../../schemas/NotificationSchema');
// const axios = require('axios');  // or use fetch

// app.use(bodyParser.urlencoded({ extended: false }));

// router.post("/", async (req, res, next) => {
//     if (!req.body.content || !req.body.chatId) {
//         console.log("Invalid data passed into request");
//         return res.sendStatus(400);
//     }

//     console.log("ChatId:", req.body.chatId)

//     const chat = await Chat.findById(req.body.chatId).populate('users');
//     console.log("Users in chat:", chat.users);  // Log all users in the chat

//     console.log("Chatbot user ID type:", typeof chat.users[0]._id);
//     console.log("Chatbot user ID:", chat.users[0]._id.toString());

//     const chatTest = await Chat.findById(req.body.chatId).populate('users');
//     const isChatbotUser = chat.users.some(user => user._id.toString() === '66ba9992e2e4833f78e591f9');
//     console.log("Chatbot user found:", isChatbotUser);




//     // const isChatbotUser = await User.findOne({
//     //     _id: req.body.chatId,
//     //     users: { $in: ["66ba9992e2e4833f78e591f9"] }  // Replace <CHATBOT_USER_ID> with your chatbot's user ID
//     // });
//     console.log(isChatbotUser)

//     if (isChatbotUser) {
//         try {
//             const chatbotResponse = await axios.post('https://empathaiapi-kize6gbndq-nw.a.run.app/api/ask', {
//                 question: req.body.content,
//                 session_id: 'session1'
//             });

//             const botMessage = {
//                 sender: "66ba9992e2e4833f78e591f9",  // Replace with your chatbot's user ID
//                 content: chatbotResponse.data.answer,
//                 chat: req.body.chatId
//             };

//             const savedBotMessage = await Message.create(botMessage);
//             const populatedMessage = await savedBotMessage.populate("sender").execPopulate();
//             await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: populatedMessage });
//             res.status(201).send(populatedMessage);

//         } catch (error) {
//             console.log("Chatbot API error: ", error);
//             return res.sendStatus(500);
//         }
//     } else {
//         var newMessage = {
//             sender: req.session.user._id,
//             content: req.body.content,
//             chat: req.body.chatId
//         };

//         Message.create(newMessage)
//             .then(async message => {
//                 message = await message.populate("sender").execPopulate();
//                 message = await message.populate("chat").execPopulate();
//                 message = await User.populate(message, { path: "chat.users" });

//                 var chat = await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message })
//                     .catch(error => console.log(error));

//                 insertNotifications(chat, message);

//                 res.status(201).send(message);
//             })
//             .catch(error => {
//                 console.log(error);
//                 res.sendStatus(400);
//             });
//     }
// });

// function insertNotifications(chat, message) {
//     chat.users.forEach(userId => {
//         if (userId == message.sender._id.toString()) return;

//         Notification.insertNotification(userId, message.sender._id, "newMessage", message.chat._id);
//     });
// }

// module.exports = router;

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
        const chatbotUserId = '66ba9992e2e4833f78e591f9';  // Declare the chatbot user ID here
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

