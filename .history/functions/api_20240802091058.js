
const serverless = require('serverless-http');
const express = require('express');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');

// AWS Configuration
AWS.config.update({
  region: 'us-east-1',
  dynamoDbCrc32: false,
  accessKeyId: 'AKIAQ3EGP2YO547O7LHI',
  secretAccessKey: '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'
});

const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const app = express();
app.use(bodyParser.json());

// Routes

// Fetch all Events
app.get('/api/all_events', asyncHandler(async (req, res) => {
  const params = {
    TableName: 'events',
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  };
  try
  const data = await dynamoDB.scan(params).promise();
  res.json(data.Items || []);
}));

// Fetch Content
app.get('/api/all_attendees', asyncHandler(async (req, res) => {
  const awsAttendeesParams = {
    TableName: 'attendees',
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  };
  const awsAttendeesData = await dynamoDB.scan(awsAttendeesParams).promise();

  const chatRequestParams = {
    TableName: 'chat_request',
  };
  const chatRequestData = await dynamoDB.scan(chatRequestParams).promise();

  const chatRoomsParams = {
    TableName: 'chatrooms',
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  };
  const chatRoomsData = await dynamoDB.scan(chatRoomsParams).promise();

  res.json({
    aws_attendees: awsAttendeesData.Items || [],
    chat_requests: chatRequestData.Items || [],
    chatRooms: chatRoomsData.Items || []
  });
}));

// Fetch Posts
app.get('/api/posts', asyncHandler(async (req, res) => {
  const params = {
    TableName: 'all_posts',
  };
  const data = await dynamoDB.scan(params).promise();
  console.log("api data",data)
  res.json(data.Items || []);
}));

// Fetch User Posts
app.get('/api/user-posts/:userId', asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const params = {
    TableName: 'all_posts',
    KeyConditionExpression: 'uid = :uid',
    ExpressionAttributeValues: {
      ':uid': userId,
    },
  };
  const data = await dynamoDB.query(params).promise();
  res.json(data.Items || []);
}));

// Fetch Chat
app.get('/api/chat/:roomID', asyncHandler(async (req, res) => {
  const roomID = req.params.roomID;
  const params = {
    TableName: 'chatrooms',
    KeyConditionExpression: 'room_id = :room_id',
    ExpressionAttributeValues: {
      ':room_id': roomID,
    },
  };
  const data = await dynamoDB.query(params).promise();
  res.json(data.Items || []);
}));

// Fetch Event Object
app.get('/api/event-object/:eventId', asyncHandler(async (req, res) => {
  const eventId = req.params.eventId;
  const params = {
    TableName: 'events',
    KeyConditionExpression: 'mdx = :mdx',
    ExpressionAttributeValues: {
      ':mdx': eventId,
    },
  };
  const data = await dynamoDB.query(params).promise();
  res.json(data.Items[0] || null);
}));

// Fetch Comments
app.get('/api/comments/:postId', asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const params = {
    TableName: 'comments',
    KeyConditionExpression: 'postId = :postId',
    ExpressionAttributeValues: {
      ':postId': postId,
    },
  };
  const data = await dynamoDB.query(params).promise();
  res.json(data.Items || []);
}));

// Create Post
app.post('/api/posts', asyncHandler(async (req, res) => {
  const { eventId, uid, userName, posterImage, content, imageURI, videoURI } = req.body;
  const postId = uuidv4();
  let uploadedImageURI = null;
  let uploadedVideoURI = null;

  // Upload image to S3 if present
  if (imageURI) {
    const response = await fetch(imageURI);
    const blob = await response.blob();
    const file = new File([blob], "image.jpg", { type: blob.type });
    uploadedImageURI = await uploadToS3(file, file.type, 'postmedia/images');
  }

  // Upload video to S3 if present
  if (videoURI) {
    const response = await fetch(videoURI);
    const blob = await response.blob();
    const file = new File([blob], "video.mp4", { type: blob.type });
    uploadedVideoURI = await uploadToS3(file, file.type, 'postmedia/videos');
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
    createdAt: new Date().toISOString(),
    likesCount: 0,
  };

  const params = {
    TableName: 'all_posts',
    Item: newPost,
  };

  await dynamoDB.put(params).promise();
  res.status(201).json(newPost);
}));

// Like Post
app.post('/api/posts/:postId/like', asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const params = {
    TableName: 'all_posts',
    Key: { postId },
    UpdateExpression: 'SET likesCount = likesCount + :increment',
    ExpressionAttributeValues: {
      ':increment': 1,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  const data = await dynamoDB.update(params).promise();
  res.json(data.Attributes);
}));

// Add Chat Request to AWS
app.post('/api/chat-requests', asyncHandler(async (req, res) => {
  const { senderId, receiverId } = req.body;
  const chatRequestId = uuidv4();
  const newChatRequest = {
    uid: chatRequestId,
    senderId: senderId,
    receiverId: receiverId,
    status: "pending",
    timestamp: new Date().toISOString(),
  };

  const params = {
    TableName: 'chat_request',
    Item: newChatRequest,
  };

  await dynamoDB.put(params).promise();
  res.status(201).json(newChatRequest);
}));

// Update User Bio
app.put('/api/users/:userId/bio', asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { newBio } = req.body;

  const params = {
    TableName: 'attendees',
    Key: { 'uid': userId },
    UpdateExpression: 'SET bio = :bio',
    ExpressionAttributeValues: {
      ':bio': newBio,
    },
  };

  await dynamoDB.update(params).promise();
  res.json({ message: 'Bio updated successfully!' });
}));

const uploadToS3 = async (file, contentType, folder) => {
  const fileName = `${folder}/${Date.now()}_${file.name}`;
  const params = {
    Bucket: 'moxieeventsbucket',
    Key: fileName,
    Body: file,
    ContentType: contentType
  };
  try {
    const { Location } = await s3.upload(params).promise();
    return Location; // Return the S3 URL
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });


module.exports.handler = serverless(app);
