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
const crypto = require('crypto');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { error } = require('console');
const cloudinary = require('cloudinary').v2;


dotenv.config();

const app = express();
app.use(bodyParser.json());

// app.use(cors({
//   origin: ['*', "https://skip-api-1gup.onrender.com", "http://localhost:3000"]
// }));



//trying to disable cors

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});


cloudinary.config({
  cloud_name:'dnko3bvt0',
  api_key:"754199529786361",
  api_secret:'rZfTpZO7DvDxx3LdAfIzN0n3T98'
})


const isAdmin = (req, res, next) => {
  if (req.auth.isAdmin) {
    return next();
  } else {
    res.status(403).json({ message: 'Wrong turn taken' });
  }
};


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
const AdminUsers = db.collection("admins")
const Payment = db.collection('payments');
// JWT Middleware Setup
const jwtSecret = "64649Sk!p$@1YFFD6573";
// const authenticate = jwtMiddleware({ secret: jwtSecret, algorithms: ['HS256'],  credentialsRequired: true});

//manage sessions..





// const session = require('express-session');

// app.use(session({
//   secret: 'your_session_secret',
//   resave: false,
//   saveUninitialized: true,
//   cookie: { secure: true, httpOnly: true, sameSite: 'Strict' } // Cookie settings for production
// }));

// app.post('/auth/login', async (req, res) => {
//   const { email, password } = req.body;
  
//   const user = await User.findOne({ email });
//   if (user && await bcrypt.compare(password, user.password)) {
//     // Store user information in session
//     req.session.userId = user.id;
//     req.session.isAdmin = user.isAdmin;
//     res.status(200).json({ message: 'Logged in successfully' });
//   } else {
//     res.status(401).json({ message: 'Invalid credentials' });
//   }
// });

// // Middleware to check session
// const authenticate = (req, res, next) => {
//   if (req.session.userId) {
//     return next();
//   }
//   res.status(401).json({ message: 'Unauthorized' });
// };
// 


const authenticate = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.auth = decoded;
    next();
  });
};

// Serve static files and HTML documentation
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, './public', 'index.html'));
});


const transporter = nodemailer.createTransport({
  host: "smtp.titan.email",
  secure:"true",
  tls:{
    ciphers:"SSLv3",
  },

  requireTLS:"true",
  port:465,
  debug:"true",
  connectionTimeout:"10000",

  auth:{
    user:"dev@moxie5agency.com",
    pass:"dev@64649Tu"

  }
})


async function mailer(email) {

  const info = await transporter.sendMail({
    from:`"Sk!p Events"<dev@moxie5agency.com>`,
    to:email,
    subject:"Event Registration",
    text:"Welcome To Moxie5 Events",

  })
  
}



const uploadUserImage = (path)=>{
  return new Promise((resolve, reject)=>{
    cloudinary.uploader.upload(path, {folder:"user_images"}, (error, result)=>{
      if(error){
        reject(error)
      } else {
        resolve(result.url)
      }
    })
  })
}


const uploadEventImage = (path)=>{
  return new Promise((resolve, reject)=>{
    cloudinary.uploader.upload(path, {folder:"event_posters"}, (error, result)=>{
      if(error){
        reject(error)
      } else {
        resolve(result.url)
      }
    })
  })
}

const uploadChatImages = (path)=>{
  return new Promise((resolve, reject)=>{
    cloudinary.uploader.upload(path, {folder:"chat_images"}, (error, result)=>{
      if(error){
        reject(error)
      } else {
        resolve(result.url)
      }
    })
  })
}


const uploadVideo = (path)=>{
  return new Promise((resolve, reject)=>{
    cloudinary.uploader.upload(path, {resource_type:"video", folder:"videos"}, (error, result)=>{
      if(error){
        reject(error);
      } else {
        resolve(result.secure_url)
      }
    })
  })
}

// Authentication Endpoints
app.post('/auth/signup', asyncHandler(async (req, res) => {
  const { username, email, password, userImage } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try{
    const imagePath = await uploadUserImage(userImage);
    const user = { id: uuidv4(), username, email, password: hashedPassword, userImage:imagePath };
    await User.insertOne(user);
    res.status(201).json({ message: 'User registered successfully!' });
    mailer(email).catch(console.error)
  } catch(error){
    res.status(500).json({message:error})
  }
}));

app.post("/auth/make_root", asyncHandler(async (req, res) => {
  const { email, password, userImage } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);  
  try {
    const imagePath = await uploadUserImage(userImage);

    await AdminUsers.insertOne({
      username: "root",
      email: email,
      password: hashedPassword,  // Save the hashed password
      isAdmin: true,
      userImage:imagePath
  });

  res.status(201).json({ message: 'Admin user created successfully!' });
  mailer(email).catch(console.error)
  } catch (error) {
    console.log("error uploading image", error)
  }


}));

// const match = await bcrypt.compare('123456789', hashedPassword);
// console.log(match);


app.post('/auth/root', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await AdminUsers.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign(
      { 
        userId: user.id,
        isAdmin: user.isAdmin  // admin status in the token payload

      },
      jwtSecret,
      { expiresIn: '4h' }
    );
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
}));



app.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ userId: user.id,
      isAdmin: user.isAdmin
    }, jwtSecret, { expiresIn: '4h' });
    res.json({ token });
  // i will send the token in an HTTP-only cookie
  res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'Strict' });
    
  res.status(200).json({ message: 'Logged in successfully' });

  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
}));

app.post('/auth/refresh-token', authenticate, asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const token = jwt.sign({ userId }, jwtSecret, { expiresIn: '4h' });
  res.json({ token });
}));

// User Management

app.get('/get_user/:user_id', asyncHandler(async (req, res) => {
  const userId = req.params.user_id;
  const user = await User.findOne({ id: userId });
  res.json(user);
}));

app.get('/all_users', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const users = await User.find().toArray();
  res.json(users);
}));

app.delete('/all_users/:user_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const userId = req.params.user_id;
  await User.deleteOne({ id: userId });
  res.json({ message: 'User deleted' });
}));

// Event Management 
app.post('/create_event', authenticate, isAdmin, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden action' });
  const event = { ...req.body, eventId: uuidv4(), organizerId: req.auth.userId };
  await Event.insertOne(event);
  res.status(201).json(event);
}));

app.post('/create_attendee/:event_id/', authenticate, asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;
  const attendee = { ...req.body, attendeeId: uuidv4(), eventId };
  await Attendee.insertOne(attendee);
  res.status(201).json(attendee);
}));

app.get('/get_attendees/:event_id', asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;
  const attendees = await Attendee.find({ eventId }).toArray();
  res.json(attendees);
}));



app.get('/get_all_events', asyncHandler(async (req, res) => {
  const events = await Event.find().toArray();
  res.json(events);
}));

app.get('/get_event/:event_id', asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;
  const event = await Event.findOne({ eventId });
  res.json(event);
}));

app.put('/edit_events/:event_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const updates = req.body;
  const updatedEvent = await Event.findOneAndUpdate({ eventId: req.params.event_id }, { $set: updates }, { returnDocument: 'after' });
  res.json(updatedEvent.value);
}));

app.delete('/delete_event/:event_id', authenticate, asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  await Event.deleteOne({ eventId: req.params.event_id });
  res.json({ message: 'Event deleted' });
}));

app.get('/all_user_event/user', authenticate, asyncHandler(async (req, res) => {
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

// Event Session Management Endpoints
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

// get chat requests for a single user
app.get('/chat-requests', authenticate, asyncHandler(async (req, res) => {
  const chatRequests = await ChatRequest.find({ receiverId: req.auth.userId }).toArray();
  res.json(chatRequests);
}));


// create a peer to peer chat room
app.post('/chat-rooms', authenticate, asyncHandler(async (req, res) => {
  const chatRoom = { ...req.body, roomId: uuidv4(), participants: [req.auth.userId, req.body.otherUserId], createdAt: new Date() };
  await ChatRoom.insertOne(chatRoom);
  res.status(201).json(chatRoom);
}));

//get all messages from a chat room..
app.get('/chat-rooms/:room_id/messages', authenticate, asyncHandler(async (req, res) => {
  const roomId = req.params.room_id;
  const chatRoom = await ChatRoom.findOne({ roomId });
  res.json(chatRoom?.messages || []);
}));


//send notifications
app.post('/notifications', authenticate, asyncHandler(async (req, res) => {
  const notification = { ...req.body, notificationId: uuidv4(), userId: req.auth.userId, createdAt: new Date() };
  await Notification.insertOne(notification);
  res.status(201).json(notification);
}));

//get notification
app.get('/notifications', authenticate, asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.auth.userId }).toArray();
  res.json(notifications);
}));


//setting up node mailer


// mailer().catch(console.error)


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
