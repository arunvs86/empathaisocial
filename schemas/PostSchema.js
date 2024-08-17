const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PostSchema = new Schema({
    content: { type: String, trim: true },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    pinned: Boolean,
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    retweetUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    retweetData: { type: Schema.Types.ObjectId, ref: 'Post' },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Post' },
    pinned: Boolean,
    spamMarks: { type: Number, default: 0 }, // New field for spam count
    spamMarkedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }], // New field to track users who marked spam
}, { timestamps: true });

var Post = mongoose.model('Post', PostSchema);
module.exports = Post;