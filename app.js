const express = require('express');
const app = express();
const middleware = require('./middleware');
const path = require('path');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const eventEmitter = require('./events');  // Import the event emitter
const MongoStore = require('connect-mongo');

// MongoDB Connection URI
const mongoURI = "mongodb+srv://arunvsoundararajan:Kamalhaasan%40123@empathaicluster.a0qtk.mongodb.net/EmpathAICluster?retryWrites=true&w=majority";

// Establish MongoDB connection
mongoose.connect(mongoURI)
    .then(() => {
        console.log('Database connection successful');
    })
    .catch((err) => {
        console.error('Database connection error:', err);
    });

// Setup express-session with connect-mongo
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Replace 'your-secret-key' with a strong secret
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongoURI, // Provide mongoUrl here
        ttl: 14 * 24 * 60 * 60 // Session lifetime, optional
    })
}));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log("Server listening on port " + PORT));

const io = require("socket.io")(server, { pingTimeout: 60000 });

app.set("view engine", "pug");
app.set("views", "views");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Route Definitions
app.get('/', middleware.requireLogin, (req, res, next) => {
    var payload = {
        pageTitle: "Home",
        userLoggedIn: req.session.user,
        userLoggedInJs: JSON.stringify(req.session.user),
    }

    res.status(200).render("home", payload);
});

app.get('/terms-and-conditions', (req, res) => {
    res.render('terms-and-conditions');
});

// Listen to message events
eventEmitter.on('newMessage', (newMessage) => {
    const chat = newMessage.chat;

    if (!chat || !chat.users) {
        return console.log("Chat or chat.users not defined");
    }

    chat.users.forEach(user => {
        if (user._id == newMessage.sender._id) return;

        io.in(user._id).emit("message received", newMessage);
    });
});

// Additional Routes
const loginRoute = require('./routes/loginRoutes');
const registerRoute = require('./routes/registerRoutes');
const logoutRoute = require('./routes/logout');
const postRoute = require('./routes/postRoutes');
const profileRoute = require('./routes/profileRoutes');
const uploadRoute = require('./routes/uploadRoutes');
const searchRoute = require('./routes/searchRoutes');
const messagesRoute = require('./routes/messagesRoutes');
const notificationsRoute = require('./routes/notificationRoutes');

// Api routes
const postsApiRoute = require('./routes/api/posts');
const usersApiRoute = require('./routes/api/users');
const chatsApiRoute = require('./routes/api/chats');
const messagesApiRoute = require('./routes/api/messages');
const notificationsApiRoute = require('./routes/api/notifications');

app.use("/login", loginRoute);
app.use("/register", registerRoute);
app.use("/logout", logoutRoute);
app.use("/posts", middleware.requireLogin, postRoute);
app.use("/profile", middleware.requireLogin, profileRoute);
app.use("/uploads", uploadRoute);
app.use("/search", middleware.requireLogin, searchRoute);
app.use("/messages", middleware.requireLogin, messagesRoute);
app.use("/notifications", middleware.requireLogin, notificationsRoute);

app.use("/api/posts", postsApiRoute);
app.use("/api/users", usersApiRoute);
app.use("/api/chats", chatsApiRoute);
app.use("/api/messages", messagesApiRoute);
app.use("/api/notifications", notificationsApiRoute);

io.on("connection", socket => {
    socket.on("setup", userData => {
        socket.join(userData._id);
        socket.emit("connected");
    });

    socket.on("join room", room => socket.join(room));

    socket.on("typing", room => socket.in(room).emit("typing"));
    socket.on("stop typing", room => socket.in(room).emit("stop typing"));

    socket.on("new message", newMessage => {
        var chat = newMessage.chat;

        if (!chat || !chat.users) {
            return console.log("Chat or chat.users not defined");
        }

        chat.users.forEach(user => {
            if (user._id == newMessage.sender._id) return;

            socket.in(user._id).emit("message received", newMessage);
        });
    });
});