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
const Notification = db.collection('notifications');

const User = db.collection('users');
const Payment = db.collection('payments');

// JWT Middleware Setup
const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
const authenticate = jwtMiddleware({ secret: jwtSecret, algorithms: ['HS256'] });

// Serve static files and HTML documentation
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, './public', 'index.html'));
});

// Authentication Endpoints
app.post('/auth/signup', asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), username, email, password: hashedPassword };
  await User.insertOne(user);
  res.status(201).json({ message: 'User registered successfully!' });
}));

app.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
}));

app.post('/auth/refresh-token', authenticate, asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const token = jwt.sign({ userId }, jwtSecret, { expiresIn: '1h' });
  res.json({ token });
}));

// User Management Endpoints
app.get('/users/profile', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findOne({ id: req.auth.userId });
  res.json(user);
}));

app.put('/users/profile', authenticate, asyncHandler(async (req, res) => {
  const updates = req.body;
  const updatedUser = await User.findOneAndUpdate({ id: req.auth.userId }, { $set: updates }, { returnDocument: 'after' });
  res.json(updatedUser.value);
}));

app.get('/users/:user_id', asyncHandler(async (req, res) => {
  const userId = req.params.user_id;
  const user = await User.findOne({ id: userId });
  res.json(user);
}));

app.get('/users', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const users = await User.find().toArray();
  res.json(users);
}));

app.delete('/users/:user_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const userId = req.params.user_id;
  await User.deleteOne({ id: userId });
  res.json({ message: 'User deleted' });
}));

// Event Management Endpoints
app.post('/events', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const event = { ...req.body, eventId: uuidv4(), organizerId: req.auth.userId };
  await Event.insertOne(event);
  res.status(201).json(event);
}));

app.get('/events', asyncHandler(async (req, res) => {
  const events = await Event.find().toArray();
  res.json(events);
}));

app.get('/events/:event_id', asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;
  const event = await Event.findOne({ eventId });
  res.json(event);
}));

app.put('/events/:event_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const updates = req.body;
  const updatedEvent = await Event.findOneAndUpdate({ eventId: req.params.event_id }, { $set: updates }, { returnDocument: 'after' });
  res.json(updatedEvent.value);
}));

app.delete('/events/:event_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  await Event.deleteOne({ eventId: req.params.event_id });
  res.json({ message: 'Event deleted' });
}));

app.get('/events/user', authenticate, asyncHandler(async (req, res) => {
  const events = await Event.find({ attendees: req.auth.userId }).toArray();
  res.json(events);
}));

app.post('/events/:event_id/sign-up', authenticate, asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;
  await Event.updateOne({ eventId }, { $addToSet: { attendees: req.auth.userId } });
  res.json({ message: 'Signed up for event' });
}));

app.get('/events/:event_id/users', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const event = await Event.findOne({ eventId: req.params.event_id });
  res.json(event?.attendees || []);
}));

// Session Management Endpoints
app.get('/events/:event_id/sessions', asyncHandler(async (req, res) => {
  const sessions = await db.collection('sessions').find({ eventId: req.params.event_id }).toArray();
  res.json(sessions);
}));

app.post('/events/:event_id/sessions', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const session = { ...req.body, sessionId: uuidv4(), eventId: req.params.event_id };
  await db.collection('sessions').insertOne(session);
  res.status(201).json(session);
}));

app.get('/events/:event_id/sessions/:session_id', asyncHandler(async (req, res) => {
  const session = await db.collection('sessions').findOne({ sessionId: req.params.session_id });
  res.json(session);
}));

app.put('/events/:event_id/sessions/:session_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const updates = req.body;
  const updatedSession = await db.collection('sessions').findOneAndUpdate({ sessionId: req.params.session_id }, { $set: updates }, { returnDocument: 'after' });
  res.json(updatedSession.value);
}));

app.delete('/events/:event_id/sessions/:session_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  await db.collection('sessions').deleteOne({ sessionId: req.params.session_id });
  res.json({ message: 'Session deleted' });
}));

app.post('/events/:event_id/sessions/:session_id/attend', authenticate, asyncHandler(async (req, res) => {
  const sessionId = req.params.session_id;
  await db.collection('sessions').updateOne({ sessionId }, { $addToSet: { attendees: req.auth.userId } });
  res.json({ message: 'Signed up for session' });
}));

app.get('/events/:event_id/sessions/:session_id/users', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const session = await db.collection('sessions').findOne({ sessionId: req.params.session_id });
  res.json(session?.attendees || []);
}));

// Payment Management Endpoints
app.post('/payments', authenticate, asyncHandler(async (req, res) => {
  const payment = { ...req.body, paymentId: uuidv4(), userId: req.auth.userId };
  await Payment.insertOne(payment);
  res.status(201).json(payment);
}));

app.get('/payments', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const payments = await Payment.find().toArray();
  res.json(payments);
}));

app.get('/payments/:payment_id', authenticate, asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ paymentId: req.params.payment_id });
  res.json(payment);
}));

app.put('/payments/:payment_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const updates = req.body;
  const updatedPayment = await Payment.findOneAndUpdate({ paymentId: req.params.payment_id }, { $set: updates }, { returnDocument: 'after' });
  res.json(updatedPayment.value);
}));

app.delete('/payments/:payment_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  await Payment.deleteOne({ paymentId: req.params.payment_id });
  res.json({ message: 'Payment deleted' });
}));


//get all attendees for an event
app.get('/events/:event_id/attendees', asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;
  const attendees = await Attendee.find({ eventId }).toArray();
  res.json(attendees);
}));

//add an attendee to an event
app.post('/events/:event_id/attendees', authenticate, asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;
  const attendee = { ...req.body, attendeeId: uuidv4(), eventId };
  await Attendee.insertOne(attendee);
  res.status(201).json(attendee);
}));


//create a post
app.post('/posts', authenticate, asyncHandler(async (req, res) => {
  const post = { ...req.body, postId: uuidv4(), userId: req.auth.userId, createdAt: new Date() };
  await Post.insertOne(post);
  res.status(201).json(post);
}));


//get all posts
app.post('/posts', authenticate, asyncHandler(async (req, res) => {
  const post = { ...req.body, postId: uuidv4(), userId: req.auth.userId, createdAt: new Date() };
  await Post.insertOne(post);
  res.status(201).json(post);
}));


//send chat requests
app.post('/chat-requests', authenticate, asyncHandler(async (req, res) => {
  const chatRequest = { ...req.body, requestId: uuidv4(), senderId: req.auth.userId, status: 'pending', createdAt: new Date() };
  await ChatRequest.insertOne(chatRequest);
  res.status(201).json(chatRequest);
}));




// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
