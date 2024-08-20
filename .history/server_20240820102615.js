const express = require('express');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { expressjwt: jwtMiddleware } = require('express-jwt');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(bodyParser.json());

const uri = 'mongodb+srv://dev:64649$@cluster0.snn3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  ssl: true,
});

async function connectToDatabase() {
  try {
    await client.connect();
    await client.db("skip_db").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to the server!");
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

connectToDatabase().catch(console.dir);

const db = client.db("skip_db");

const Event = db.collection('events');
const Attendee = db.collection('attendees');
const Post = db.collection('posts');
const ChatRequest = db.collection('chatRequests');
const ChatRoom = db.collection('chatRooms');

app.use(express.static(path.join(__dirname, 'public'))); // Adjust this path if needed

// Serve the HTML documentation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, './public','index.html'));
});

// Routes

app.get('/api/events', asyncHandler(async (req, res) => {
  const events = await Event.find().toArray();
  res.json(events || []);
}));

app.get('/api/all_attendees', asyncHandler(async (req, res) => {
  const attendees = await Attendee.find().toArray();
  const chatRequests = await ChatRequest.find().toArray();
  const chatRooms = await ChatRoom.find().toArray();

  res.json({
    aws_attendees: attendees || [],
    chat_requests: chatRequests || [],
    chatRooms: chatRooms || []
  });
}));

app.get('/api/posts', asyncHandler(async (req, res) => {
  const posts = await Post.find().toArray();
  res.json(posts || []);
}));

app.get('/api/user-posts/:userId', asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const posts = await Post.find({ uid: userId }).toArray();
  res.json(posts || []);
}));

app.get('/api/chat/:roomID', asyncHandler(async (req, res) => {
  const roomID = req.params.roomID;
  const chatRoom = await ChatRoom.findOne({ room_id: roomID });
  res.json(chatRoom || null);
}));

app.get('/api/event-object/:eventId', asyncHandler(async (req, res) => {
  const eventId = req.params.eventId;
  const event = await Event.findOne({ eventId });
  res.json(event || null);
}));

app.get('/api/comments/:postId', asyncHandler(async (req, res) => {
  // Assuming you have a Comment collection, adjust the code accordingly
  const postId = req.params.postId;
  const comments = await db.collection('comments').find({ postId }).toArray();
  res.json(comments || []);
}));

app.get('/api/chat_members/:password', asyncHandler(async (req, res) => {
  const password = req.params.password;
  const chatRooms = await ChatRoom.find({ participants: password }).toArray();
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
  
  // Directly use imageURI and videoURI from frontend
  const newPost = {
    postId: postId,
    event_id: eventId,
    uid: uid,
    userName: userName,
    posterImage: posterImage,
    content: content,
    image: imageURI,
    video: videoURI,
    createdAt: new Date(),
    likesCount: 0,
  };

  await Post.insertOne(newPost);
  res.status(201).json(newPost);
}));

app.post('/api/posts/:postId/like', asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const post = await Post.findOneAndUpdate(
    { postId: postId },
    { $inc: { likesCount: 1 } },
    { returnDocument: 'after' }
  );
  res.json(post.value);
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

  await ChatRequest.insertOne(newChatRequest);
  res.status(201).json(newChatRequest);
}));

app.put('/api/users/:userId/bio', asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { bio } = req.body;

  const updatedAttendee = await Attendee.findOneAndUpdate(
    { uid: userId },
    { $set: { bio: bio } },
    { returnDocument: 'after' }
  );
  
  res.json(updatedAttendee.value);
}));

// Endpoint to upload image (no longer required)
// app.post('/upload-user-image', asyncHandler(async (req, res) => {
//   const { image, fileName } = req.body;
//   const file = bucket.file(`images/${fileName}`);

//   const buffer = Buffer.from(image, 'base64');
//   await file.save(buffer, {
//     contentType: 'image/jpeg',
//   });

//   const [url] = await file.getSignedUrl({
//     action: 'read',
//     expires: '03-09-2491'
//   });

//   res.json({ location: url });
// }));

app.post('/add-attendee', asyncHandler(async (req, res) => {
  const { formData } = req.body;
  const attendee = { ...formData, uid: uuidv4() };
  await Attendee.insertOne(attendee);
  res.status(200).send('Success');
}));

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
