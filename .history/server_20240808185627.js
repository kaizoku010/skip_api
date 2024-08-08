const express = require('express');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');
const path = require('path');


//mongo connection link with password...mongodb+srv://dev:<65659$>@cluster0.snn3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
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

// Serve the HTML documentation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './public/index.html'));
});

// Routes

app.get('/api/all_events', asyncHandler(async (req, res) => {
  const params = {
    TableName: 'events',
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  };
  const data = await dynamoDB.scan(params).promise();
  res.json(data.Items || []);
}));

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

app.get('/api/posts', asyncHandler(async (req, res) => {
  const params = {
    TableName: 'all_posts',
  };
  const data = await dynamoDB.scan(params).promise();
  res.json(data.Items || []);
}));

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

app.get('/api/chat_members/:password', asyncHandler(async (req, res) => {
  const params = {
    TableName: 'chatrooms',
    FilterExpression: 'contains(participants, :password)',
    ExpressionAttributeValues: {
      ':password': password,
    },
  };
  const data = await dynamoDB.query(params).promise();
  res.json(data.Items || []);
}));



app.get('/api/new_chat/', asyncHandler(async (req, res) => {

  const newMessage = {
    messageId: uuidv4(), // Generate a unique ID for the message
    content: messageInput,
    sender: user.uid,
    timestamp: new Date().toISOString(),
    image: user.image || ic_placeHolder
  };

  try {
    const params = {
      TableName: 'chatrooms', 
      Key: { room_id: roomID },
      UpdateExpression: 'SET messages = list_append(messages, :newMessage)',
      ExpressionAttributeValues: {
        ':newMessage': [newMessage],
      },
      ReturnValues: 'ALL_NEW',
    };

    await dynamoDB.update(params).promise();
  } catch (error) {
    console.error('Error sending message:', error);
  }
}));



app.post('/api/posts', asyncHandler(async (req, res) => {
  const { eventId, uid, userName, posterImage, content, imageURI, videoURI } = req.body;
  const postId = uuidv4();
  let uploadedImageURI = null;
  let uploadedVideoURI = null;

  if (imageURI) {
    const response = await fetch(imageURI);
    const blob = await response.blob();
    const file = new File([blob], "image.jpg", { type: blob.type });
    uploadedImageURI = await uploadToS3(file, file.type, 'postmedia/images');
  }

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

app.post('/api/posts/:postId/like', asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const params = {
    TableName: 'all_posts',
    Key: {
      postId: postId,
    },
    UpdateExpression: 'SET likesCount = likesCount + :val',
    ExpressionAttributeValues: {
      ':val': 1,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  const result = await dynamoDB.update(params).promise();
  res.json(result.Attributes);
}));



app.post('/api/chat-requests', asyncHandler(async (req, res) => {
  const { receiverId, senderId, status } = req.body;
  const requestId = uuidv4();

  const newChatRequest = {
    uid: requestId,
    receiverId: receiverId,
    senderId: senderId,
    status: status,
    timestamp: new Date().toISOString(),
  };

  const params = {
    TableName: 'chat_request',
    Item: newChatRequest,
  };

  await dynamoDB.put(params).promise();
  res.status(201).json(newChatRequest);
}));

app.put('/api/users/:userId/bio', asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { bio } = req.body;

  const params = {
    TableName: 'attendees',
    Key: {
      uid: userId,
    },
    UpdateExpression: 'SET bio = :bio',
    ExpressionAttributeValues: {
      ':bio': bio,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  const result = await dynamoDB.update(params).promise();
  res.json(result.Attributes);
}));





//upload event graphics to s3
async function uploadToS3(file, contentType, folder) {
  const fileName = `${folder}/${uuidv4()}-${file.name}`;
  const params = {
    Bucket: 'moxieeventsbucket',
    Key: fileName,
    Body: file,
    ContentType: contentType,
    // ACL: 'public-read',
  };

  const data = await s3.upload(params).promise();
  return data.Location;
}


///add event
app.post('/api/add-event', asyncHandler(async (req, res) => {
  const { eventData } = req.body;
  const { eventGraphics } = req.files;
  
  let eventGraphicsURL = '';
  if (eventGraphics) {
    eventGraphicsURL = await uploadToS3(eventGraphics, eventGraphics.mimetype, 'eventGraphics');
  }

  const eventItem = {
    ...JSON.parse(eventData),
    eventGraphicsURL,
  };

  const params = {
    TableName: 'events',
    Item: eventItem,
  };

  await dynamoDB.put(params).promise();
  res.status(201).json({ message: 'Event added successfully!' });
}));



// Endpoint to upload image to S3
app.post('/upload-user-image', async (req, res) => {
  const { image, fileName } = req.body;

  const params = {
    Bucket: 'moxieeventsbucket',
    Key: `images/${fileName}`,
    Body: Buffer.from(image, 'base64'),
    ContentType: 'image/jpeg',
  };

  try {
    const data = await s3.upload(params).promise();
    res.json({ location: data.Location });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


//signup user
app.post('/signup', async (req, res) => {
  const { email, code, attributeList } = req.body;

  const params = {
    ClientId: '714k6vrn207tf567haia6ljvpg',
    UserPoolId: 'ap-south-1_YRFnyDxCR',
    Username: email,
    Password: code,
    UserAttributes: attributeList,
  };

  try {
    const data = await cognito.signUp(params).promise();
    res.json({ user: data.UserSub });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Endpoint to add attendee to DynamoDB
app.post('/add-attendee', async (req, res) => {
  const { formData } = req.body;

  const params = {
    TableName: 'attendees',
    Item: formData,
  };

  try {
    await dynamoDB.put(params).promise();
    res.status(200).send('Success');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
