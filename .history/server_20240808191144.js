const express = require('express');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const { Readable } = require('stream');
const { MongoClient, ServerApiVersion } = require('mongodb');


// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: 'your-firebase-bucket-url'
});

const bucket = admin.storage().bucket();

const app = express();
app.use(bodyParser.json());
const uri = 'mongodb+srv://dev:65659$@cluster0.snn3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'

// MongoDB connection
const client = new MongoClient(uri, {
  serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
  },
  ssl: true

});


async function connectToDatabase() {
}

connectToDatabase().catch(console.dir);


const Event = mongoose.model('Event', new mongoose.Schema({
  eventId: String,
  uid: String,
  eventName: String,
  eventDate: Date,
  eventGraphicsURL: String,
}));

const Attendee = mongoose.model('Attendee', new mongoose.Schema({
  uid: String,
  userName: String,
  bio: String,
}));

const Post = mongoose.model('Post', new mongoose.Schema({
  postId: String,
  event_id: String,
  uid: String,
  userName: String,
  posterImage: String,
  content: String,
  image: String,
  video: String,
  createdAt: Date,
  likesCount: Number,
}));

const ChatRequest = mongoose.model('ChatRequest', new mongoose.Schema({
  uid: String,
  receiverId: String,
  senderId: String,
  status: String,
  timestamp: Date,
}));

const ChatRoom = mongoose.model('ChatRoom', new mongoose.Schema({
  room_id: String,
  participants: [String],
  messages: [{
    messageId: String,
    content: String,
    sender: String,
    timestamp: Date,
    image: String,
  }],
}));

// Serve the HTML documentation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './public/index.html'));
});

// Routes

app.get('/api/all_events', asyncHandler(async (req, res) => {
  const events = await Event.find().exec();
  res.json(events || []);
}));

app.get('/api/all_attendees', asyncHandler(async (req, res) => {
  const attendees = await Attendee.find().exec();
  const chatRequests = await ChatRequest.find().exec();
  const chatRooms = await ChatRoom.find().exec();

  res.json({
    aws_attendees: attendees || [],
    chat_requests: chatRequests || [],
    chatRooms: chatRooms || []
  });
}));

app.get('/api/posts', asyncHandler(async (req, res) => {
  const posts = await Post.find().exec();
  res.json(posts || []);
}));

app.get('/api/user-posts/:userId', asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const posts = await Post.find({ uid: userId }).exec();
  res.json(posts || []);
}));

app.get('/api/chat/:roomID', asyncHandler(async (req, res) => {
  const roomID = req.params.roomID;
  const chatRoom = await ChatRoom.findOne({ room_id: roomID }).exec();
  res.json(chatRoom || null);
}));

app.get('/api/event-object/:eventId', asyncHandler(async (req, res) => {
  const eventId = req.params.eventId;
  const event = await Event.findOne({ eventId }).exec();
  res.json(event || null);
}));

app.get('/api/comments/:postId', asyncHandler(async (req, res) => {
  // Assuming you have a Comment model, adjust the code accordingly
  const postId = req.params.postId;
  const comments = await Comment.find({ postId }).exec();
  res.json(comments || []);
}));

app.get('/api/chat_members/:password', asyncHandler(async (req, res) => {
  // Adjust this logic as needed; assuming password refers to participant's unique identifier
  const password = req.params.password;
  const chatRooms = await ChatRoom.find({ participants: password }).exec();
  res.json(chatRooms || []);
}));

app.post('/api/new_chat', asyncHandler(async (req, res) => {
  const { roomID, messageInput, user } = req.body;

  const newMessage = {
    messageId: uuidv4(),
    content: messageInput,
    sender: user.uid,
    timestamp: new Date(),
    image: user.image || ''
  };

  await ChatRoom.updateOne(
    { room_id: roomID },
    { $push: { messages: newMessage } }
  );

  res.status(201).json(newMessage);
}));

app.post('/api/posts', asyncHandler(async (req, res) => {
  const { eventId, uid, userName, posterImage, content, imageURI, videoURI } = req.body;
  const postId = uuidv4();
  let uploadedImageURI = null;
  let uploadedVideoURI = null;

  if (imageURI) {
    uploadedImageURI = await uploadToFirebase(imageURI, 'images');
  }

  if (videoURI) {
    uploadedVideoURI = await uploadToFirebase(videoURI, 'videos');
  }

  const newPost = {
    postId: postId,
    event_id: eventId,
    uid: uid,
    userName: userName,
    posterImage: posterImage,
    content: content,
    image: uploadedImageURI,
    video: uploadedVideoURI,
    createdAt: new Date(),
    likesCount: 0,
  };

  const post = new Post(newPost);
  await post.save();
  res.status(201).json(newPost);
}));

app.post('/api/posts/:postId/like', asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const post = await Post.findOneAndUpdate(
    { postId: postId },
    { $inc: { likesCount: 1 } },
    { new: true }
  ).exec();
  res.json(post);
}));

app.post('/api/chat-requests', asyncHandler(async (req, res) => {
  const { receiverId, senderId, status } = req.body;
  const requestId = uuidv4();

  const newChatRequest = {
    uid: requestId,
    receiverId: receiverId,
    senderId: senderId,
    status: status,
    timestamp: new Date(),
  };

  const chatRequest = new ChatRequest(newChatRequest);
  await chatRequest.save();
  res.status(201).json(newChatRequest);
}));

app.put('/api/users/:userId/bio', asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { bio } = req.body;

  const updatedAttendee = await Attendee.findOneAndUpdate(
    { uid: userId },
    { bio: bio },
    { new: true }
  ).exec();

  res.json(updatedAttendee);
}));

async function uploadToFirebase(fileUri, folder) {
  const fileName = `${folder}/${uuidv4()}-${path.basename(fileUri)}`;
  const file = bucket.file(fileName);
  const response = await fetch(fileUri);
  const buffer = await response.buffer();
  
  const stream = Readable.from(buffer);
  await new Promise((resolve, reject) => {
    stream.pipe(file.createWriteStream())
      .on('error', reject)
      .on('finish', resolve);
  });

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-09-2491'
  });

  return url;
}

// Endpoint to upload image to Firebase Storage
app.post('/upload-user-image', asyncHandler(async (req, res) => {
  const { image, fileName } = req.body;
  const file = bucket.file(`images/${fileName}`);

  const buffer = Buffer.from(image, 'base64');
  await file.save(buffer, {
    contentType: 'image/jpeg',
  });

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-09-2491'
  });

  res.json({ location: url });
}));

app.post('/signup', asyncHandler(async (req, res) => {
  // Firebase Authentication would be used here for signup
  res.status(501).json({ message: 'Signup functionality not implemented' });
}));

app.post('/add-attendee', asyncHandler(async (req, res) => {
  const { formData } = req.body;
  const attendee = new Attendee(formData);
  await attendee.save();
  res.status(200).send('Success');
}));

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
