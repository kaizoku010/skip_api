require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const asyncHandler = require("express-async-handler");
const bodyParser = require("body-parser");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { expressjwt: jwtMiddleware } = require("express-jwt");
const crypto = require("crypto");
const fs = require("fs");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { error } = require("console");
const cloudinary = require("cloudinary").v2;
const PDFDocument = require("pdfkit");
const qr = require("qr-image"); // QR code generation
const multer = require("multer");
const upload = multer({ dest: "uploads/" }); // You can change the destination folder
const morgan = require("morgan");
const winston = require("winston");
const cookieParser = require("cookie-parser");

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

// console.log("testing env", process.env)
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    credentials: false,
  })
);

app.options("*", cors()); // Enable pre-flight across-the-board

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Allow all origins
  res.header("Access-Control-Allow-Headers", "*"); // Allow all headers
  next();
});

app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
  });
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: "rZfTpZO7DvDxx3LdAfIzN0n3T98",
});

const isAdmin = (req, res, next) => {
  if (req.auth.isAdmin) {
    return next();
  } else {
    res.status(403).json({ message: "Wrong turn taken" });
  }
};

const uri = process.env.MONGO_URI;
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
const Event = db.collection("events");
const Attendee = db.collection("attendees");
const Post = db.collection("posts");
const ChatRequest = db.collection("chatRequests");
const ChatRoom = db.collection("chatRooms");
const Notification = db.collection("notifications");
const User = db.collection("users");
const Chat = db.collection("chats");
const AdminUsers = db.collection("admins");
const Payment = db.collection("payments");
// JWT Middleware Setup
const jwtSecret = process.env.JWT_SEC;

// async function cleanupSessions() {

//   try {
//     const collection = db.collection('events');

//     const result = await collection.updateMany(
//       { "sessions": null },
//       { $pull: { "sessions": null } }
//     );

//     console.log(`${result.modifiedCount} documents updated.`);
//   } finally {
//     await client.close();
//   }
// }

// cleanupSessions().catch(console.error);

const authenticate = (req, res, next) => {
  const token = req.cookies ? req.cookies.auth_token : null; //safe gaurd

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.auth = decoded;
    next();
  });
};

const transporter = nodemailer.createTransport({
  host: "smtp.titan.email",
  secure: "true",
  tls: {
    ciphers: "SSLv3",
  },

  requireTLS: "true",
  port: 465,
  debug: "true",
  connectionTimeout: "10000",

  auth: {
    user: "dev@moxie5agency.com",
    pass: "dev@64649Tu",
  },
});

async function mailer(email, password) {
  await transporter.sendMail({
    from: `"Sk!p Events"<dev@moxie5agency.com>`,
    to: email,
    subject: "Event Registration Complete",
    text: `Welcome To Moxie5 Events, proceed by logging into your sk!p account...here are your login details. User Email: ${email}, password: ${password}`,
  });
}

app.use("/logs", express.static(path.join(__dirname, "logs")));

// Send email with attachment
const sendTicketWithAttachment = async (to, subject, text, attachmentPath) => {
  const mailOptions = {
    from: "dev@moxie5agency.com",
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

const uploadUserImage = (path) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      path,
      { folder: "user_images" },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.url);
        }
      }
    );
  });
};

const uploadPostImage = (path) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      path,
      { folder: "post_media" },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
  });
};

const uploadEventImage = (path) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      path,
      { folder: "event_posters" },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
  });
};

const uploadChatImages = (path) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      path,
      { folder: "chat_images" },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.url);
        }
      }
    );
  });
};

const uploadVideo = (path) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      path,
      { resource_type: "video", folder: "videos" },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
  });
};

const generateTicket = (user, event, filePath) => {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));
  const logoPath = path.join(__dirname, "./public/skip.png");
  // doc.image(logoPath, { fit: [95, 95], align: 'left' }).moveDown(2);
  // doc.fontSize(20).text('Skip Ticket', { align: 'left' }).moveDown(1);

  // User and Event Info
  doc
    .fontSize(16)
    .text(`Name: ${user.username}`, { align: "left" })
    .moveDown(0.5);
  doc.text(`Email: ${user.userEmail}`, { align: "left" }).moveDown(0.5);
  doc.text(`Event: ${event.eventName}`, { align: "left" }).moveDown(0.5);
  doc.text(`Date: ${event.eventDate}`, { align: "left" }).moveDown(2);

  // Generate QR code
  const qrCodeData = `Event: ${event.eventName}, Attendee: ${user.username}, UserEmail: ${event.userEmail}`;
  const qrImage = qr.imageSync(qrCodeData, { type: "png", size: 5 });

  // QR Code below the text
  doc.image(qrImage, doc.page.width / 2 - 50, doc.y, {
    fit: [100, 100],
    align: "center",
  });

  // Footer Text
  doc
    .moveDown(5)
    .fontSize(12)
    .text("www.moxie5agency.com", { align: "center" });

  doc.end();
};

app.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const { token } = req.query;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { email } = decoded;

      // Activate the user
      await User.updateOne({ email }, { $set: { isVerified: true } });

      res.status(200).json({ message: "Email verified successfully!" });
    } catch (error) {
      console.error("Email verification error:", error);
      res
        .status(400)
        .json({ message: "Invalid or expired verification link." });
    }
  })
);

const sendVerificationEmail = async (email) => {
  const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  const verificationLink = `/verify-email?token=${verificationToken}`;

  await mailer(
    email,
    "Verify Your Email",
    `Click on this link to verify your email: ${verificationLink}`
  );
};

// Authentication Endpoints
app.post(
  "/auth/signup",
  upload.single("userImage"),
  asyncHandler(async (req, res) => {
    const { username, email, password, job, gender, industry, phone, age, position } =
      req.body;
    const userImage = req.file;

    if (!req.file) {
      return res.status(400).json({ message: "Image not uploaded" });
    }

    try {
      //check if email exists already
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const imagePath = await uploadUserImage(userImage.path);

      const user = {
        id: uuidv4(),
        username: username,
        email: email,
        password: hashedPassword,
        userImage: imagePath,
        phone: phone,
        job: job,
        gender: gender,
        industry: industry,
      };
      await User.insertOne(user); // Chck tht User.insertOne is functioning correctly

      fs.unlinkSync(userImage.path);

      res.status(201).json({ message: "User registered successfully!" });

      // Send a verification email
      await sendVerificationEmail(email).catch(console.error);
    } catch (error) {
      console.error("Error during signup:", error); // Add this to log the full error stack trace
      res
        .status(500)
        .json({ message: error.message || "Internal Server Error" });
    }
  })
);

app.post(
  "/auth/make_root",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const userImage = req.file;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const imagePath = await uploadUserImage(userImage);

      await AdminUsers.insertOne({
        username: "root",
        email: email,
        password: hashedPassword, // Save the hashed password
        isAdmin: true,
        userImage: imagePath,
      });

      res.status(201).json({ message: "Admin user created successfully!" });
      mailer(email).catch(console.error);
    } catch (error) {
      console.log("error uploading image", error);
    }
  })
);

// const match = await bcrypt.compare('123456789', hashedPassword);
// console.log(match);login

app.post(
  "/auth/root",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await AdminUsers.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign(
        {
          userId: user.id,
          isAdmin: user.isAdmin, // admin status in the token payload
        },
        jwtSecret,
        { expiresIn: "4h" }
      );
      res.json({ token });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  })
);

//login

app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    console.log("Received request:", { email, password });

    const user = await User.findOne({ email });
    // console.log("User:", user);

    if (!user) {
      console.log("User not found");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      const token = jwt.sign({ userId: user.id }, jwtSecret, {
        expiresIn: "4h",
      });
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
      });
      res.status(200).json({
        message: "Logged in successfully",
        token,
        user: {
          userId: user.id,
          userName: user.username,
          userEmail: user.email,
          phone: user.phone,
          job: user.job,
          gender: user.gender,
          industry: user.industry,
          userImage: user.userImage,
        },
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  })
);

//signup for an event
app.post(
  "/sign_up_event/:eventId",
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { userId } = req.auth;
    const user = await User.findOne({ id: userId });

    // Check if the event exists
    const event = await Event.findOne({ eventId });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    // Check if the user is already signed up
    else if (event.participants && event.participants.includes(userId)) {
      return res
        .status(400)
        .json({ message: "User already signed up for this event" });
    }

    try {
      await Event.updateOne({ eventId }, { $push: { participants: user } });

      res.status(200).json({ message: "Successfully signed up for the event" });
    } catch (error) {
      console.error("attendee addition error:", error);
    }
  })
);

app.post(
  "/auth/refresh-token",
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const token = jwt.sign({ userId }, jwtSecret, { expiresIn: "4h" });
    res.json({ token });
  })
);

app.get("/test-json", (req, res) => {
  res.json({ message: "This is a JSON response" });
});
// User Management

app.get(
  "/get_user/:user_id",
  asyncHandler(async (req, res) => {
    const userId = req.params.user_id;
    const user = await User.findOne({ id: userId });

    if (user) {
      res.status(200).json(user); // Sends JSON response
    } else {
      res.status(404).json({ message: "User not found" });
    }
  })
);

app.get(
  "/all_use",
  asyncHandler(async (req, res) => {
    // return res.status(403).json({ message: 'Forbidden' });
    const users = await User.find().toArray();
    res.json(users);
  })
);

// Edit user
app.put(
  "/edit_user/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { username, email } = req.body;

    const updatedUser = await User.findOneAndUpdate(
      { _id: ObjectId(id) }, // Using ObjectId here
      { $set: { username, email } },
      { returnOriginal: false }
    );

    if (!updatedUser.value) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(updatedUser.value);
  })
);

// Delete user
app.delete(
  "/delete_user/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deletedUser = await User.findOneAndDelete(
      { _id: ObjectId(id) } // Using ObjectId here
    );

    if (!deletedUser.value) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  })
);

app.get(
  "/all_users",
  asyncHandler(async (req, res) => {
    try {
      const users = await User.find().toArray();
      res.json(users);
    } catch (error) {
      console.error("Error getting Users: ", error);
    }

    //  res.json(users);
  })
);

app.delete(
  "/all_users/:user_id",
  asyncHandler(async (req, res) => {
    try {
      const userId = req.params.user_id;
      await User.deleteOne({ id: userId });
      res.json({ message: "User deleted" });
    } catch (error) {
      console.error("Error Deleting Users: ", error);
    }
  })
);

app.delete(
  "/all_users/:user_id",
  asyncHandler(async (req, res) => {
    try {
      const userId = req.params.user_id;
      await User.deleteOne({ id: userId });
      res.json({ message: "User deleted" });
    } catch (error) {
      console.error("Error Deleting Users: ", error);
    }
  })
);

app.get(
  "/all_user_event/:user_id",
  asyncHandler(async (req, res) => {
    const { userId } = req.body;
    const events = await Event.find({ attendees: userId }).toArray();
    res.json(events);
  })
);

// Event Management
app.post(
  "/create_event",
  upload.single("eventImage"),
  asyncHandler(async (req, res) => {
    console.log("Request Body: ", req.body); // Log body content
    try {
      const eventImage = req.file;
      const imagePath = await uploadEventImage(eventImage.path);
      const event = { ...req.body, eventId: uuidv4(), eventImage: imagePath };
      const insertResult = await Event.insertOne(event);
      console.log("Insert Result: ", insertResult);
      res.status(201).json({
        event,
        message: "event_created",
      });
    } catch (error) {
      console.error("Error Creating Event: ", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  })
);

app.post(
  "/create_event_speaker",
  asyncHandler(async (req, res) => {
    const { event_id, speaker_name } = req.params;
    const event = await Event.findOne({ eventId: event_id });
    if (!event) {
      return res
        .status(404)
        .json({ message: "Event not found, please try again" });
    }

    try {
      // Add the new session to the event
      await Event.updateOne(
        { eventId: event_id },
        { $push: { speakers: speaker_name } }
      );

      res.status(200).json({
        message: "Session created successfully",
        event_speaker: speaker_name,
      });
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  })
);

app.post(
  "/create_event_",
  asyncHandler(async (req, res) => {
    const event = { ...req.body, eventId: uuidv4(), organizerId: "mdxi" };
    await Event.insertOne(event);
    res.status(201).json(event);
  })
);

//create event attendee
app.post(
  "/create_attendee/:event_id",
  asyncHandler(async (req, res) => {
    const { event_id } = req.params; // Extract event_id from URL
    const {
      user_id,
      userName,
      phoneNumber,
      email,
      ageRange,
      jobIndustry,
      userimage,
    } = req.body; // Extract attendee data from request body

    if (!userName || !phoneNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find the event
    const event = await Event.findOne({ eventId: event_id });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if the user is already an attendee for this event
    const existingAttendee = event.attendees.find(
      (attendee) => attendee.userEmail === email
    );

    if (existingAttendee) {
      return res
        .status(409)
        .json({ message: "User is already signed up for this event" });
    }

    try {
      const newAttendee = {
        attendeeId: uuidv4(), // Generate a unique ID for the attendee
        userId: user_id,
        username: userName,
        contact: phoneNumber,
        userEmail: email,
        userImage: userimage,
        job: jobIndustry,
        age: ageRange,
        ticketCreatedAt: new Date(), // Record the creation date
      };

      // Add the new attendee to the event
      await Event.updateOne(
        { eventId: event_id },
        { $push: { attendees: newAttendee } }
      );
      const ticketFilePath = path.join(
        __dirname,
        "tickets",
        `${newAttendee.username}.pdf`
      );

      // Generate the ticket PDF
      generateTicket(newAttendee, event, ticketFilePath);

      // Send the ticket via email
      await sendTicketWithAttachment(
        newAttendee.userEmail,
        "Your Event Ticket",
        "Please find your event ticket attached.",
        ticketFilePath
      );

      res
        .status(200)
        .json({ message: "Attendee created successfully", attendee: user_id });
    } catch (error) {
      console.error("Error creating attendee:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  })
);

app.get(
  "/get_attendees/:event_id",
  asyncHandler(async (req, res) => {
    const eventId = req.params.event_id;

    try {
      // Find the event by its ID
      const event = await Event.findOne({ eventId });

      // Check if the event exists
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const attendees = event.attendees;

      res.json(attendees);
    } catch (error) {
      console.error("Error fetching attendees:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  })
);

app.get(
  "/checkins/:event_id",
  asyncHandler(async (req, res) => {
    const eventId = req.params.event_id;
    try {
      const event = await Event.findOne({ eventId });
      res.json(event);
    } catch (error) {
      console.error("Error fetching checkins:", error);
      res.status(404).json({ message: "Event not found" });
      res.status(500).json({ message: "Internal server error" });
    }
  })
);

app.get(
  "/get_all_events",
  asyncHandler(async (req, res) => {
    const events = await Event.find().toArray();
    res.json(events);
  })
);

app.get(
  "/get_event/:event_id",
  asyncHandler(async (req, res) => {
    const eventId = req.params.event_id;
    const event = await Event.findOne({ eventId });
    res.json(event);
  })
);

app.put(
  "/edit_events/:event_id",
  asyncHandler(async (req, res) => {
    try {
      const updates = req.body;
      const updatedEvent = await Event.findOneAndUpdate(
        { eventId: req.params.event_id },
        { $set: updates },
        { returnDocument: "after" }
      );
      res.json(updatedEvent.value);
    } catch (error) {
      console.error("Error Editing Event");
    }
  })
);

app.delete(
  "/delete_event/:event_id",
  asyncHandler(async (req, res) => {
    try {
      await Event.deleteOne({ eventId: req.params.event_id });
      res.json({ message: "Event deleted" });
    } catch (error) {
      console.error("Error Deleting Event");
    }
  })
);

app.delete(
  "/delete_attendee/:event_id/:attendeeId",
  asyncHandler(async (req, res) => {
    try {
      const { event_id, attendeeId } = req.params;

      console.log(
        `Deleting attendee with ID: ${attendeeId} for event ID: ${event_id}`
      );

      // Find the event by its ID
      const event = await Event.findOne({ eventId: event_id }); // Replace with your event model
      // console.log("event found:", event)
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if the attendee exists in the attendees array
      const attendeeIndex = event.attendees.findIndex(
        (attendee) =>
          typeof attendee === "object" && attendee.attendeeId === attendeeId
      );

      console.log("Attendee to be deleted: ".attendeeIndex);

      if (attendeeIndex === -1) {
        return res
          .status(404)
          .json({ message: "Attendee not found in this event" });
      }

      // Remove the attendee
      event.attendees.splice(attendeeIndex, 1);

      // Save the updated event
      await Event.updateOne(
        { eventId: event_id },
        { $set: { attendees: event.attendees } }
      );

      res.json({ message: "Attendee deleted, Event Updated" });
    } catch (error) {
      console.error("Error Deleting Attendee", error);
      res.status(500).json({ message: error.message });
    }
  })
);

//edit attendee information
app.put(
  "/edit_attendee/:event_id/:attendeeId",
  asyncHandler(async (req, res) => {
    try {
      const updates = req.body;
      const updatedUser = await User.findOneAndUpdate(
        { attendeeId: req.params.attendeeId },
        { $set: updates },
        { returnDocument: "after" }
      );
      res.json(updatedUser.value);
    } catch (error) {
      console.error("Event Session Error", error);
    }
  })
);

app.get(
  "/all_user_event/user",
  asyncHandler(async (req, res) => {
    const events = await Event.find({ attendees: req.auth.userId }).toArray();
    res.json(events);
  })
);

//signup for an event
app.post(
  "/events/:event_id/sign-up",
  asyncHandler(async (req, res) => {
    const eventId = req.params.event_id;
    await Event.updateOne(
      { eventId },
      { $addToSet: { attendees: req.auth.userId } }
    );
    res.json({ message: "Signed up for event" });
  })
);

app.get(
  "/events/:event_id/users",
  asyncHandler(async (req, res) => {
    try {
      const event = await Event.findOne({ eventId: req.params.event_id });
      res.json(event?.attendees || []);
    } catch (error) {
      console.error("Error Getting Event Attendess");
    }
  })
);

// Event Session Management Endpoints
app.post(
  "/events/:event_id/create_sessions",
  asyncHandler(async (req, res) => {
    const session_object = req.body;
    const { event_id } = req.params;

    const event = await Event.findOne({ eventId: event_id });
    if (!event) {
      return res
        .status(404)
        .json({ message: "Event not found, please try again" });
    }

    try {
      // Generate a unique session ID and add it to the session object
      const newSession = {
        ...session_object, // Spread the session details
        sessionId: uuidv4(), // Add a unique session ID
      };

      // Add the new session to the event
      await Event.updateOne(
        { eventId: event_id },
        { $push: { sessions: newSession } } // Push the new session
      );

      res
        .status(200)
        .json({ message: "Session created successfully", session: newSession });
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  })
);
app.get(
  "/events/:event_id/sessions",
  asyncHandler(async (req, res) => {
    try {
      const event = await Event.findOne({ eventId: req.params.event_id });
      res.json(event?.sessions || []);
    } catch (error) {
      console.error("Error Getting Event Sessions", error);
    }
  })
);

app.get(
  "/events/:event_id/sessions/:session_id",
  asyncHandler(async (req, res) => {
    const session = await db
      .collection("sessions")
      .findOne({ sessionId: req.params.session_id });
    res.json(session);
  })
);

app.put(
  "/events/:event_id/sessions/:session_id",
  asyncHandler(async (req, res) => {
    try {
      const updates = req.body;
      const updatedSession = await db
        .collection("sessions")
        .findOneAndUpdate(
          { sessionId: req.params.session_id },
          { $set: updates },
          { returnDocument: "after" }
        );
      res.json(updatedSession.value);
    } catch (error) {
      console.error("Event Session Error", error);
    }
  })
);

app.delete(
  "/events/:event_id/sessions/:session_id",
  asyncHandler(async (req, res) => {
    const { event_id, session_id } = req.params;

    try {
      const event = await Event.findOne({ eventId: event_id });
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Remove the session with the given sessionId
      await Event.updateOne(
        { eventId: event_id },
        { $pull: { sessions: { sessionId: session_id } } } // Pull the session by sessionId
      );

      res.status(200).json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Delete Session Error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  })
);

app.post(
  "/events/:event_id/sessions/:session_id/attend",
  asyncHandler(async (req, res) => {
    const sessionId = req.params.session_id;
    await db
      .collection("sessions")
      .updateOne({ sessionId }, { $addToSet: { attendees: req.auth.userId } });
    res.json({ message: "Signed up for session" });
  })
);

app.get(
  "/events/:event_id/sessions/:session_id/users",
  asyncHandler(async (req, res) => {
    if (!req.auth.isAdmin)
      return res.status(403).json({ message: "Forbidden" });
    const session = await db
      .collection("sessions")
      .findOne({ sessionId: req.params.session_id });
    res.json(session?.attendees || []);
  })
);

// Payment Management Endpoints
app.post(
  "/payments",
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.body;
      const payment = { ...req.body, paymentId: uuidv4(), userId: userId };
      await Payment.insertOne(payment);
      res.status(201).json(payment);
    } catch (error) {
      console.error("error making payment: ", error);
    }
  })
);

app.get(
  "/get_payments",
  asyncHandler(async (req, res) => {
    try {
      const payments = await Payment.find().toArray();
      res.json(payments);
    } catch (error) {
      console.error("Error getting Tickets: ", error);
    }
  })
);

app.get(
  "/get_payment/:payment_id",
  asyncHandler(async (req, res) => {
    try {
      const payment = await Payment.findOne({
        paymentId: req.params.payment_id,
      });
      res.json(payment);
    } catch (error) {
      console.error("Error getting Ticket By Id: ", error);
    }
  })
);

//create fourm
app.post(
  "/create_post/:eventId",
  upload.single("mediaUrl"), // Add this middleware to handle the file upload
  asyncHandler(async (req, res) => {
    const { userId, content, userName, userImage } = req.body;
    const { eventId } = req.params;
    const mediaFile = req.file;

    // Validate required fields
    if (!userId || !content) {
      return res
        .status(400)
        .json({ message: "UserId and content are required" });
    }

    let post_media_url = null;
    if (mediaFile) {
      post_media_url = await uploadPostImage(mediaFile.path); // Upload the file and get the URL
    }

    // Create a new post object
    const newPost = {
      postId: uuidv4(),
      userId: userId,
      mediaUrl: post_media_url,
      content: content,
      userName: userName,
      userImage: userImage,
      createdAt: new Date(),
    };

    try {
      // Find the event by ID and update it by pushing the new post to the posts array
      const event = await Event.findOneAndUpdate(
        { eventId: eventId },
        { $push: { posts: newPost } }, // Add the post to the posts array
        { new: true } // Return the updated document
      );

      // Check if the event was found
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Return the updated event with the new post
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  })
);

//get all posts
app.get(
  "/get_all_posts",
  asyncHandler(async (req, res) => {
    const { eventId } = req.query; // Extract userId and eventId from request body

    try {
      // Find the event with the provided eventId
      const event = await Event.findOne({ eventId: eventId });

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Filter posts by the provided userId
      // const userPosts = event.posts.filter(post => post.userId === userId);

      const userPosts = event.posts;
      // console.log("user posts mbu:", userPosts)
      // Return the user's posts for this event
      res.status(200).json(userPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ message: "Server error", error });
    }
  })
);

//delete a post....// Delete a post by postId and eventId
app.delete(
  "/delete_post/:eventId/:postId",
  asyncHandler(async (req, res) => {
    const { eventId, postId } = req.params;
    try {
      const result = await Event.updateOne(
        { eventId: eventId },
        { $pull: { posts: { postId: postId } } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: "Event or Post not found" });
      }

      res.status(200).json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Server error", error });
    }
  })
);

//add comment to a single post oba
app.post(
  "/add_comment/:eventId/:postId",
  asyncHandler(async (req, res) => {
    const { eventId, postId } = req.params;
    const { userName, userImage, comment } = req.body;

    if (!postId || !comment) {
      return res
        .status(400)
        .json({ message: "postId and comment are required" });
    }

    try {
      // Find the event by eventId
      const event = await Event.findOne({ eventId });

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Find the specific post in the event
      const postIndex = event.posts.findIndex((post) => post.postId === postId);
      if (postIndex === -1) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Create the new comment
      const newComment = {
        commentId: uuidv4(),
        userName,
        userImage,
        comment,
        createdAt: new Date(),
      };

      // Push the new comment into the post's comments array
      event.posts[postIndex].comments = event.posts[postIndex].comments || [];
      event.posts[postIndex].comments.push(newComment);

      // Update the document in the database
      await Event.findOneAndUpdate(
        { eventId, "posts.postId": postId },
        { $set: { "posts.$.comments": event.posts[postIndex].comments } }
      );
      res.status(201).json(event.posts[postIndex]); // Return the updated post
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Server error", error });
    }
  })
);

//get comments  for a single post
app.get(
  "/get_comments/:eventId/:postId",
  asyncHandler(async (req, res) => {
    const { eventId, postId } = req.params;

    try {
      const event = await Event.findOne({ eventId });

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Find the specific post
      const post = event.posts.find((post) => post.postId === postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Return the comments
      res.status(200).json(post.comments || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Server error", error });
    }
  })
);

//like or unlike a post. lol..
app.post(
  "/like_post/:eventId/:postId",
  asyncHandler(async (req, res) => {
    const { eventId, postId } = req.params;
    const { userId } = req.body;
    try {
      const event = await db.collection("events").findOne({ eventId });

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const postIndex = event.posts.findIndex((post) => post.postId === postId);
      if (postIndex === -1) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Toggle like
      const post = event.posts[postIndex];
      post.likes = post.likes || []; // Ensure the likes array exists
      const liked = post.likes.includes(userId);

      if (liked) {
        // If user has already liked the post, unlike it
        post.likes = post.likes.filter((id) => id !== userId);
      } else {
        // Otherwise, add the like
        post.likes.push(userId);
      }

      // Update the event in MongoDB
      await db
        .collection("events")
        .updateOne(
          { eventId, "posts.postId": postId },
          { $set: { "posts.$.likes": post.likes } }
        );

      // Send back the updated likes count
      res.status(200).json({ likes: post.likes.length });
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({ message: "Server error", error });
    }
  })
);

//get single post
app.get(
  "/get_post/:post_id",
  asyncHandler(async (req, res) => {
    const post = {
      ...req.body,
      postId: uuidv4(),
      userId: req.auth.userId,
      createdAt: new Date(),
    };
    await Post.find().toArray();
    res.status(201).json(post);
  })
);

//get all user posts
app.get(
  "/user_posts/:userId",
  asyncHandler(async (req, res) => {
    const post = {
      ...req.body,
      postId: uuidv4(),
      userId: req.auth.userId,
      createdAt: new Date(),
    };
    await Post.find().toArray();
    res.status(201).json(post);
  })
);

//send chat requests
app.post("/chat_request/:receiverId", asyncHandler(async (req, res) => {
  const { receiverId } = req.params;
  const { senderId } = req.body;

  if (!receiverId || !senderId) {
    return res.status(400).json({ success: false, message: "Sender and Receiver ID are required" });
  }

  if (receiverId === senderId) {
    return res.status(400).json({ success: false, message: "You cannot send a chat request to yourself" });
  }

  try {
    // Query the database to check the count of chat requests between senderId and receiverId
    const existingRequestsCount = await ChatRequest.countDocuments({
      senderId: senderId,
      receiverId: receiverId
    });

    // If there are already 2 requests, reject the new request
    if (existingRequestsCount >= 2) {
      return res.status(403).json({ 
        success: false, 
        message: "You have already sent the maximum number of chat requests to this user" 
      });
    }

    // Proceed with creating the new chat request if the limit is not reached
    const chatRequest = {
      requestId: uuidv4(),
      senderId: senderId,
      receiverId: receiverId,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await ChatRequest.insertOne(chatRequest);

    if (result.acknowledged) {
      return res.status(201).json({ success: true, message: "Chat request sent successfully" });
    } else {
      return res.status(500).json({ success: false, message: "Failed to send chat request" });
    }
  } catch (error) {
    console.error("Error sending chat request:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}));

// get recieved chat requests for a single user
app.get(
  "/get_all_chat_reqs/:user_id",
  asyncHandler(async (req, res) => {
    const { user_id } = req.params;
    const chatRequests = await ChatRequest.find({
      receiverId: user_id,
    }).toArray();
    res.json(chatRequests);
  })
);

// get chat requests for a single user
app.get(
  "/get_sent_chat_reqs/:user_id",
  asyncHandler(async (req, res) => {
    const { user_id } = req.params; // Destructure correctly
    try {
      const chatRequests = await ChatRequest.find({
        senderId: user_id,  // Use the correct destructured value
      }).toArray();

      if (chatRequests.length === 0) {  // Check if the array is empty
        return res.status(404).json({ message: "User Requests Not Found" });
      }

      res.status(200).json(chatRequests);  // Send the response with found requests
      // console.log("requests found:", chatRequests);
      
    } catch (error) {
      console.error("Error fetching user requests:", error);
      res.status(500).json({ message: "Server error", error });
    }
  })
);

//get recieved chat requests.
app.get(
  "/my_chat_reqs/:userEmail",
  asyncHandler(async (req, res) => {
    const { userEmail } = req.params; // Destructure correctly
    try {
      const chatRequests = await ChatRequest.find({
        receiverId: userEmail,  // Use the correct destructured value
      }).toArray();

      if (chatRequests.length === 0) {  // Check if the array is empty
        return res.status(404).json({ message: "User Requests Not Found" });
      }

      res.status(200).json(chatRequests);  // Send the response with found requests
      // console.log("requests found:", chatRequests);
      
    } catch (error) {
      console.error("Error fetching user requests:", error);
      res.status(500).json({ message: "Server error", error });
    }
  })
);

//create chat room
app.post(
  "/create_chat_room/",
  asyncHandler(async (req, res) => {
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
      res.status(500).json({ message: "Error creating chat room", error });
    }
  })
);

//get all messages from a chat room..
app.get(
  "/chat-rooms/:userId",
  asyncHandler(async (req, res) => {
    const  {roomId } = req.params;
    const chatRoom = await ChatRoom.findOne({ roomId });
    res.json(chatRoom?.messages || []);
  })
);

// Accept a chat request
app.put(
  "/chat_requests/:request_id/:userId/accept",
  asyncHandler(async (req, res) => {
    const { request_id, userId } = req.params;
    const { action } = req.body;

    // Validate action
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    // Find the chat request
    const chatRequest = await ChatRequest.findOne({ requestId: request_id });
    if (!chatRequest) {
      return res.status(404).json({ message: "Chat request not found" });
    }

    // Ensure user is authorized
    if (chatRequest.receiverId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Update request status
    const updatedStatus = action === 'accept' ? 'accepted' : 'declined';
    await ChatRequest.findOneAndUpdate(
      { requestId: request_id },
      { $set: { status: updatedStatus } },
      { returnDocument: 'after' }
    );

    if (action === 'accept') {
      const chatRoom = {
        chatRoomId: uuidv4(),
        name: `Chat between ${chatRequest.senderId} and ${chatRequest.receiverId}`,
        participants: [chatRequest.senderId, chatRequest.receiverId],
        createdAt: new Date(),
        createdBy: userId,
      };

      await ChatRoom.insertOne(chatRoom);
      return res.status(201).json({
        message: "Chat request accepted and chat room created",
        chatRoom,
      });
    }

    res.json({
      message: `Chat request ${updatedStatus}`,
    });
  })
)

// Delete a chat
app.delete(
  "/delete_chat/:chat_id",
  asyncHandler(async (req, res) => {
    const chatId = req.params.chat_id;

    // Check if the chat exists
    const chat = await Chat.findOne({ chatId });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Optionally: Check if the user is authorized to delete this chat
    if (
      chat.senderId !== req.auth.userId &&
      chat.receiverId !== req.auth.userId
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Delete the chat
    await Chat.deleteOne({ chatId });

    res.json({ message: "Chat deleted" });
  })
);


//get all chaRoom messages
app.post(
  "/chat_rooms/:roomId/messages/:userId",
  asyncHandler(async (req, res) => {
    const { roomId, userId } = req.params;
    const { senderId, content } = req.body; // The user sending the message and the message content

    const message = {
      messageId: uuidv4(),
      chatRoomId: roomId,
      senderId,
      content,
      timestamp: new Date(),
    };

    try {
      await Chat.insertOne(message); // Assuming Message is your MongoDB collection for messages
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Error sending message", error });
    }
  })
);

//get single room
app.get(
  "/chat_rooms/:roomId",
  asyncHandler(async (req, res) => {
    const { roomId } = req.params;

    try {
      const messages = await Chat.find({ chatRoomId: roomId }).toArray(); // Assuming Message is your MongoDB collection for messages
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Error fetching messages", error });
    }
  })
);


//get a single user chat rooms
app.get(
  "/user_chatrooms/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    try {
      const chatRooms = await ChatRoom.find({ participants: userId }).toArray(); // Assuming Message is your MongoDB collection for messages
      res.json(chatRooms);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user chat rooms", error });
    }
  })
);


app.post(
  "/send_message",
  asyncHandler(async (req, res) => {
    const { chatRoomId, messageContent } = req.body;
    const senderId = req.auth.userId;

    if (!chatRoomId || !messageContent) {
      return res
        .status(400)
        .json({ message: "Chat room ID and message content are required" });
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
    res.status(201).json({ message: "Message sent successfully", message });
  })
);

app.get(
  "/get_messages/:chat_room_id",
  asyncHandler(async (req, res) => {
    const chatRoomId = req.params.chat_room_id;

    if (!chatRoomId) {
      return res.status(400).json({ message: "Chat room ID is required" });
    }

    const messages = await Chat.find({ chatRoomId })
      .sort({ timestamp: 1 })
      .toArray();
    res.json(messages);
  })
);



////start here...

// Function to remove duplicates by email
const removeDuplicateParticipants = (attendees) => {
  const seenEmails = new Set();
  return attendees.filter((attendee) => {
    if (seenEmails.has(attendee.userEmail)) {
      return false;
    } else {
      seenEmails.add(attendee.userEmail);
      return true;
    }
  });
};

// Assuming you have already set up your Express app
app.get('/chat_rooms/:userId', asyncHandler(async (req, res) => {
  const {userId}= req.params
  try {
    const chatRooms = await ChatRoom.find({ participants: userId }); 
    res.json(chatRooms);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chat rooms', error });
  }
}));


// Serve static files and HTML documentation
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./public", "index.html"));
});

app.use(express.static("public")); // Ensure static files are not conflicting

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

//setting up node mailer

const accessLogStream = fs.createWriteStream(path.join(__dirname, "logs.log"), {
  flags: "a",
});
app.use(morgan("combined", { stream: accessLogStream }));

// Setup winston for general logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],

});



// /delete function..
// async function deleteAllChatRequests() {
//   try {
//     await client.connect();
    
//     const result = await ChatRequest.deleteMany({});
//     console.log(`${result.deletedCount} operation complete.`);
//   } catch (error) {
//     console.error('Error deleting chat requests:', error);
//   } finally {
//     await client.close();
//   }
// }

// deleteAllChatRequests();

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
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


//accrediting attendees, checls
app.get('/checkin_user/:userEmail', asyncHandler(async (req, res) => {
  const {userEmail}= req.params
  try {
    const chatRooms = await ChatRoom.find({ participants: userId }); 
    res.json(chatRooms);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chat rooms', error });
  }
}));


app.post("/checkin_user", asyncHandler(async()){
  const {attendeeId} = req.body
})



app.post(
  "/chat_rooms/:roomId/messages/:userId",
  asyncHandler(async (req, res) => {
    const { roomId, userId } = req.params;
    const { senderId, content } = req.body; // The user sending the message and the message content

    const message = {
      messageId: uuidv4(),
      chatRoomId: roomId,
      senderId,
      content,
      timestamp: new Date(),
    };

    try {
      await Chat.insertOne(message); // Assuming Message is your MongoDB collection for messages
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Error sending message", error });
    }
  })
);



// Serve the HTML file
app.get("/logs", (req, res) => {
  fs.readFile("./public/logs.log", "utf8", (err, data) => {
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
