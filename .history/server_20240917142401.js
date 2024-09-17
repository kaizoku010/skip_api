require('dotenv').config();

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { expressjwt: jwtMiddleware } = require('express-jwt');
const crypto = require('crypto');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { error } = require('console');
const cloudinary = require('cloudinary').v2;
const PDFDocument = require('pdfkit');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // You can change the destination folder
const morgan = require('morgan');
const winston = require('winston');
const cookieParser = require('cookie-parser');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

// console.log("testing env", process.env)

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));

app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
  });
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});


cloudinary.config({
  cloud_name:process.env.CLOUD_NAME,
  api_key:process.env.API_KEY,
  api_secret:process.env.API_SECRET
})


const isAdmin = (req, res, next) => {
  if (req.auth.isAdmin) {
    return next();
  } else {
    res.status(403).json({ message: 'Wrong turn taken' });
  }
};

const uri = process.env.MONGO_URI
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
const Chat = db.collection("chats")
const AdminUsers = db.collection("admins")
const Payment = db.collection('payments');
// JWT Middleware Setup
const jwtSecret = process.env.JWT_SEC;




const authenticate = (req, res, next) => {
  const token = req.cookies ? req.cookies.auth_token : null; //safe gaurd

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

 await transporter.sendMail({
    from:`"Sk!p Events"<dev@moxie5agency.com>`,
    to:email,
    subject:"Event Registration",
    text:"Welcome To Moxie5 Events",

  })
  
}

app.use('/logs', express.static(path.join(__dirname, 'logs')));





// Send email with attachment
const sendTicketWithAttachment = async (to, subject, text, attachmentPath) => {
  const mailOptions = {
    from: 'sales@skipug.com',
    to,
    subject,
    text,
    attachments: [
      {
        filename: path.basename(attachmentPath),
        path: attachmentPath,
      },
    ],
  };

  return transporter.sendMail(mailOptions);
};




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


const uploadPostImage = (path)=>{
  return new Promise((resolve, reject)=>{
    cloudinary.uploader.upload(path, {folder:"post_media"}, (error, result)=>{
      if(error){
        reject(error)
      } else {
        resolve(result.secure_url)
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
        resolve(result.secure_url)
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


const generateTicket = (user, event, filePath) => {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(25).text('Event Ticket', { align: 'center' });
  doc.fontSize(18).text(`Name: ${user.username}`);
  doc.fontSize(18).text(`Email: ${user.email}`);
  doc.fontSize(18).text(`Event: ${event.name}`);
  doc.fontSize(18).text(`Date: ${event.date}`);
  
  doc.end();
};

// Authentication Endpoints
app.post('/auth/signup',  upload.single('userImage'), asyncHandler(async (req, res) => {

  const { username, email, password } = req.body;
  const userImage = req.file;

  if (!req.file) {
    return res.status(400).json({ message: 'Image not uploaded' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const imagePath = await uploadUserImage(userImage.path);     const user = { id: uuidv4(), username: username, email: email, password: hashedPassword, userImage: imagePath };
        await User.insertOne(user); // Chck tht User.insertOne is functioning correctly

    fs.unlinkSync(userImage.path);
  
    res.status(201).json({ message: 'User registered successfully!' });
    await mailer(email).catch(console.error); // Ensure mailer is not failing
  } catch (error) {
    console.error('Error during signup:', error); // Add this to log the full error stack trace
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
}));


app.post("/auth/make_root", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const userImage = req.file;
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
// console.log(match);login


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
  console.log('Received request:', { email, password });

  const user = await User.findOne({ email });
  console.log('User:', user);

  if (!user) {
    console.log('User not found');
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  console.log('Password Match:', passwordMatch);
  
  if (passwordMatch) {
    const token = jwt.sign({ userId: user.id, isAdmin: user.isAdmin }, jwtSecret, { expiresIn: '4h' });
    res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'Strict' });
    res.status(200).json({ message: 'Logged in successfully', token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
}));


//signup for an event
app.post('/sign_up_event/:eventId', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { userId } = req.auth;
  const user = await User.findOne({ id: userId });

  // Check if the event exists
  const event = await Event.findOne({ eventId });
 
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  } else
   // Check if the user is already signed up
  if (event.participants && event.participants.includes(userId)) {  
    return res.status(400).json({ message: 'User already signed up for this event' });
  }

  try {
      await Event.updateOne(
    { eventId },
    { $push: { participants: user } }
  );

     res.status(200).json({ message: 'Successfully signed up for the event' });

      // // Generate PDF ticket
      const ticketPath = path.join(__dirname, `tickets/${uuidv4()}.pdf`);
      generateTicket(user, event, ticketPath);
  
      // // Send email with ticket
      await sendTicketWithAttachment(user.email, 'Your Event Ticket', 'Please find your event ticket attached.', ticketPath);
  
  } catch (error) {
    console.error("attendee addition error:", error)    
  }
}));



app.post('/auth/refresh-token', asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const token = jwt.sign({ userId }, jwtSecret, { expiresIn: '4h' });
  res.json({ token });
}));


app.get('/test-json', (req, res) => {
  res.json({ message: 'This is a JSON response' });
});
// User Management

app.get('/get_user/:user_id', asyncHandler(async (req, res) => {
  const userId = req.params.user_id;
  const user = await User.findOne({ id: userId });

  if (user) {
    res.status(200).json(user); // Sends JSON response
  } else {
    res.status(404).json({ message: 'User not found' });
  }
}));


app.get('/all_use', asyncHandler(async (req, res) => {
  // return res.status(403).json({ message: 'Forbidden' });
  const users = await User.find().toArray();
  res.json(users);
}));


app.get('/all_users', asyncHandler(async (req, res) => {
try{
  const users = await User.find().toArray();
  res.json(users);

} catch (error){
console.error("Error getting Users: ", error)
}



//  res.json(users);
}));

app.delete('/all_users/:user_id', asyncHandler(async (req, res) => {

  try {
      const userId = req.params.user_id;
  await User.deleteOne({ id: userId });
  res.json({ message: 'User deleted' });
  } catch (error) {
    console.error("Error Deleting Users: ", error)

  }

}));

app.delete('/all_users/:user_id', asyncHandler(async (req, res) => {

  try {
      const userId = req.params.user_id;
  await User.deleteOne({ id: userId });
  res.json({ message: 'User deleted' });
  } catch (error) {
    console.error("Error Deleting Users: ", error)

  }

}));


app.get('/all_user_event/:user_id', asyncHandler(async (req, res) => {
  const {userId} = req.body;
    const events = await Event.find({ attendees: userId }).toArray();
    res.json(events);
  }));

// Event Management 
app.post('/create_event', upload.single("eventImage"), 
asyncHandler(async (req, res) => {
try {
  const eventImage = req.file;
  const imagePath = await uploadEventImage(eventImage.path); // Ensure this function is working properly
  const event = { ...req.body, eventId: uuidv4(), organizerId: req.auth.userId, eventImage:imagePath };
  await Event.insertOne(event);
  
  res.status(201).json({
    event,
    message: "event_created"
  });  
} catch (error) {
  console.error("Error Creating Event: ", error)

}
}));


  app.post('/create_event_speaker', asyncHandler(async (req, res) => {

    const {event_id, speaker_name} = req.params;
    const event = await Event.findOne({ eventId: event_id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found, please try again' });
    }
  
    try {
      // Add the new session to the event
      await Event.updateOne(
        { eventId: event_id },
        { $push: { speakers: speaker_name } }
      );
  
      res.status(200).json({ message: 'Session created successfully', event_speaker:speaker_name });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
    
  }));


app.post('/create_event_', asyncHandler(async (req, res) => {
  
  const event = { ...req.body, eventId: uuidv4(), organizerId: "mdxi" };
  await Event.insertOne(event);
  res.status(201).json(event);
}));

app.post('/create_attendee/:event_id', asyncHandler(async (req, res) => {
  const { event_id } = req.params; // Extract event_id from URL
  const { user_id } = req.body; // Extract attendee data from request body

  // Find the event
  const event = await Event.findOne({ eventId: event_id });

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  try {
    // Add the new attendee to the event
    await Event.updateOne(
      { eventId: event_id },
      { $push: { attendees: user_id } }
    );

    res.status(200).json({ message: 'Attendee created successfully', attendee: user_id });
  } catch (error) {
    console.error('Error creating attendee:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}));


app.get('/get_attendees/:event_id', asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;

  try {
    // Find the event by its ID
    const event = await Event.findOne({ eventId });

    // Check if the event exists
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const attendees = event.attendees; 

    res.json(attendees);
  } catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
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

app.put('/edit_events/:event_id', asyncHandler(async (req, res) => {
  try {
    const updates = req.body;
    const updatedEvent = await Event.findOneAndUpdate({ eventId: req.params.event_id }, { $set: updates }, { returnDocument: 'after' });
    res.json(updatedEvent.value);    
  } catch (error) {
    console.error("Error Editing Event")
  }

}));

app.delete('/delete_event/:event_id', asyncHandler(async (req, res) => {
try {
  await Event.deleteOne({ eventId: req.params.event_id });
  res.json({ message: 'Event deleted' }); 
} catch (error) {
  console.error("Error Deleting Event")

}

 
}));

app.get('/all_user_event/user', asyncHandler(async (req, res) => {
  const events = await Event.find({ attendees: req.auth.userId }).toArray();
  res.json(events);
}));

app.post('/events/:event_id/sign-up', asyncHandler(async (req, res) => {
  const eventId = req.params.event_id;
  await Event.updateOne({ eventId }, { $addToSet: { attendees: req.auth.userId } });
  res.json({ message: 'Signed up for event' });
}));

app.get('/events/:event_id/users', asyncHandler(async (req, res) => {
try {
  const event = await Event.findOne({ eventId: req.params.event_id });
  res.json(event?.attendees || []);  
} catch (error) {
  console.error("Error Getting Event Attendess")

}
}));

// Event Session Management Endpoints
app.post('/events/:event_id/create_sessions', asyncHandler(async (req, res) => {

  const {event_id} = req.params;
  const event = await Event.findOne({ eventId: event_id });
  if (!event) {
    return res.status(404).json({ message: 'Event not found, please try again' });
  }

  try {
    // Add the new session to the event
    await Event.updateOne(
      { eventId: event_id },
      { $push: { sessions: session_object } }
    );

    res.status(200).json({ message: 'Session created successfully', session:session_object });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
  
}));

app.get('/events/:event_id/sessions', asyncHandler(async (req, res) => {

  try {
    const event = await Event.findOne({ eventId: req.params.event_id });
    res.json(event?.sessions || []);  
  } catch (error) {
    console.error("Error Getting Event Sessions", error)

  }


}));

app.get('/events/:event_id/sessions/:session_id', asyncHandler(async (req, res) => {
  const session = await db.collection('sessions').findOne({ sessionId: req.params.session_id });
  res.json(session);
}));

app.put('/events/:event_id/sessions/:session_id', asyncHandler(async (req, res) => {

try {
  const updates = req.body;
  const updatedSession = await db.collection('sessions').findOneAndUpdate({ sessionId: req.params.session_id }, { $set: updates }, { returnDocument: 'after' });
  res.json(updatedSession.value);  
} catch (error) {
  console.error("Event Session Error", error)

}

}));

app.delete('/events/:event_id/sessions/:session_id', asyncHandler(async (req, res) => {

try {
  await db.collection('sessions').deleteOne({ sessionId: req.params.session_id });
  res.json({ message: 'Session deleted' });
} catch (error) {
  console.error("Delete Session Error", error)
}
  
}));

app.post('/events/:event_id/sessions/:session_id/attend', asyncHandler(async (req, res) => {

  const sessionId = req.params.session_id;
  await db.collection('sessions').updateOne({ sessionId }, { $addToSet: { attendees: req.auth.userId } });
  res.json({ message: 'Signed up for session' });
}));

app.get('/events/:event_id/sessions/:session_id/users', asyncHandler(async (req, res) => {
  if (!req.auth.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const session = await db.collection('sessions').findOne({ sessionId: req.params.session_id });
  res.json(session?.attendees || []);
}));

// Payment Management Endpoints
app.post('/payments', asyncHandler(async (req, res) => {

  try {
    const {userId} = req.body
    const payment = { ...req.body, paymentId: uuidv4(), userId: userId };
    await Payment.insertOne(payment);
    res.status(201).json(payment);    
  } catch (error) {
    console.error("error making payment: ", error)
  }

}));

app.get('/get_payments', asyncHandler(async (req, res) => {

  try {
    const payments = await Payment.find().toArray();
    res.json(payments);    
  } catch (error) {
    console.error("Error getting Tickets: ", error)
  }


}));

app.get('/get_payment/:payment_id', asyncHandler(async (req, res) => {

  try {
    const payment = await Payment.findOne({ paymentId: req.params.payment_id });
    res.json(payment);   
  } catch (error) {
    console.error("Error getting Ticket By Id: ", error)

  }

 
}));




//create a post
app.post('/create_post', asyncHandler(async (req, res) => {
  const { postMedia } = req.body;

  
  try {
    // Upload image to Cloudinary
    let imageUrl = '';
    if (req.file) {
      imageUrl = await uploadPostImage(postMedia); // Upload the image and get the URL
    }

    // Create post object
    const post = {
      ...req.body,
      postId: uuidv4(),
      userId: req.auth.userId,
      createdAt: new Date(),
      imageUrl // Include the image URL if available
    };
    // Insert post into MongoDB
    await Post.insertOne(post);
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}));


//get all posts
app.get('/get_all_posts', asyncHandler(async (req, res) => {
  const post = { ...req.body, postId: uuidv4(), userId: req.auth.userId, createdAt: new Date() };
  await Post.find().toArray();
  res.status(201).json(post);
}));

app.get('/get_post/:post_id', asyncHandler(async (req, res) => {
  const post = { ...req.body, postId: uuidv4(), userId: req.auth.userId, createdAt: new Date() };
  await Post.find().toArray();
  res.status(201).json(post);
}));

app.get('/user_posts/:user_id', asyncHandler(async (req, res) => {
  const post = { ...req.body, postId: uuidv4(), userId: req.auth.userId, createdAt: new Date() };
  await Post.find().toArray();
  res.status(201).json(post);
}));


//send chat requests
// Send a chat request
app.post('/send_chat_req', asyncHandler(async (req, res) => {
  // Validate request body
  const { receiverId, message } = req.body;
  if (!receiverId || !message) {
    return res.status(400).json({ message: 'Receiver ID and message are required' });
  }

  // Construct chat request object
  const chatRequest = {
    requestId: uuidv4(),   // Unique ID for the request
    senderId: req.auth.userId,   // ID of the user sending the request
    receiverId: receiverId,   // ID of the user receiving the request
    status: 'pending',   // Initial status of the chat request
    createdAt: new Date()   // Timestamp of when the request is created
  };

  try {
    // Insert chat request into the database
    const result = await ChatRequest.insertOne(chatRequest);

    // Check if the request was successfully inserted
    if (result.insertedCount === 1) {
      return res.status(201).json(chatRequest);
    } else {
      return res.status(500).json({ message: 'Failed to send chat request' });
    }
  } catch (error) {
    // Handle potential database errors
    console.error('Error sending chat request:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}));


// get chat requests for a single user
app.get('/get_all_chat_reqs/:user_id', asyncHandler(async (req, res) => {
  const chatRequests = await ChatRequest.find({ receiverId: req.auth.userId }).toArray();
  res.json(chatRequests);
}));



app.post('/create_chat_room', asyncHandler(async (req, res) => {
  const { name, participants } = req.body;


  const chatRoom = {
    chatRoomId: uuidv4(),
    name,
    participants, // An array of user IDs who are part of this chat room
    createdAt: new Date(),
    createdBy: req.auth.userId,
  };

  try {
    await ChatRoom.insertOne(chatRoom);
    res.status(201).json(chatRoom);
  } catch (error) {
    res.status(500).json({ message: 'Error creating chat room', error });
  }
}));


//get all messages from a chat room..
app.get('/chat-rooms/:room_id/messages', asyncHandler(async (req, res) => {
  const roomId = req.params.room_id;
  const chatRoom = await ChatRoom.findOne({ roomId });
  res.json(chatRoom?.messages || []);
}));

// Accept a chat request
// Accept a chat request
app.put('/accept_chat_req/:request_id', asyncHandler(async (req, res) => {
  const requestId = req.params.request_id;

  // Find the chat request
  const chatRequest = await ChatRequest.findOne({ requestId });
  if (!chatRequest) {
    return res.status(404).json({ message: 'Chat request not found' });
  }

  // Check if the user is the receiver
  if (chatRequest.receiverId !== req.auth.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Update the status to 'accepted'
  const updatedChatRequest = await ChatRequest.findOneAndUpdate(
    { requestId },
    { $set: { status: 'accepted' } },
    { returnDocument: 'after' }
  );

  // Create a new chat room
  const chatRoom = {
    chatRoomId: uuidv4(), // Generate a unique ID for the chat room
    name: `Chat between ${chatRequest.senderId} and ${chatRequest.receiverId}`, // Or any name you prefer
    participants: [chatRequest.senderId, chatRequest.receiverId],
    createdAt: new Date(),
    createdBy: req.auth.userId,
  };

  try {
    await ChatRoom.insertOne(chatRoom);
    
    res.json({
      message: 'Chat request accepted and chat room created',
      chatRoom,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating chat room', error });
  }
}));



// Delete a chat
app.delete('/delete_chat/:chat_id', asyncHandler(async (req, res) => {
  const chatId = req.params.chat_id;

  // Check if the chat exists
  const chat = await Chat.findOne({ chatId });
  if (!chat) {
    return res.status(404).json({ message: 'Chat not found' });
  }

  // Optionally: Check if the user is authorized to delete this chat
  if (chat.senderId !== req.auth.userId && chat.receiverId !== req.auth.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Delete the chat
  await Chat.deleteOne({ chatId });

  res.json({ message: 'Chat deleted' });
}));


app.post('/send_message', asyncHandler(async (req, res) => {
  const { chatRoomId, messageContent } = req.body;
  const senderId = req.auth.userId;

  if (!chatRoomId || !messageContent) {
    return res.status(400).json({ message: 'Chat room ID and message content are required' });
  }

  const message = {
    messageId: uuidv4(),
    chatRoomId,
    senderId,
    receiverId,
    messageContent,
    timestamp: new Date().toISOString(),
  };

  await Chat.insertOne(message);
  res.status(201).json({ message: 'Message sent successfully', message });
}));


app.get('/get_messages/:chat_room_id', asyncHandler(async (req, res) => {
  const chatRoomId = req.params.chat_room_id;

  if (!chatRoomId) {
    return res.status(400).json({ message: 'Chat room ID is required' });
  }

  const messages = await Chat.find({ chatRoomId }).sort({ timestamp: 1 }).toArray();
  res.json(messages);
}));






//send notifications
app.post('/notifications', asyncHandler(async (req, res) => {
  const notification = { ...req.body, notificationId: uuidv4(), userId: req.auth.userId, createdAt: new Date() };
  await Notification.insertOne(notification);
  res.status(201).json(notification);
}));

//get notification
app.get('/notifications', asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.auth.userId }).toArray();
  res.json(notifications);
}));


// Serve static files and HTML documentation
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, './public', 'index.html'));
});


app.use(express.static('public')); // Ensure static files are not conflicting

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});


//setting up node mailer


const accessLogStream = fs.createWriteStream(path.join(__dirname, 'logs.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

// Setup winston for general logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
    });
  });
  next();
});


// Serve the HTML file
app.get('/logs', (req, res) => {
  fs.readFile('./public/logs.log', 'utf8', (err, data) => {
      if (err) throw err;
      res.send(`<pre>${data}</pre>`);
  });
});

// mailer().catch(console.error)


// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
