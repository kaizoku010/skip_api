const AWS = require('aws-sdk');
const fetch = require('node-fetch'); // Ensure this is installed

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET' && event.path === '/api/all_attendees') {
      const awsAttendeesParams = {
        TableName: 'attendees',
      };
      const awsAttendeesData = await dynamoDB.scan(awsAttendeesParams).promise();

      const chatRequestParams = {
        TableName: 'chat_request',
      };
      const chatRequestData = await dynamoDB.scan(chatRequestParams).promise();

      const chatRoomsParams = {
        TableName: 'chatrooms',
      };
      const chatRoomsData = await dynamoDB.scan(chatRoomsParams).promise();

      return {
        statusCode: 200,
        body: JSON.stringify({
          aws_attendees: awsAttendeesData.Items || [],
          chat_requests: chatRequestData.Items || [],
          chatRooms: chatRoomsData.Items || []
        }),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Not Found' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};