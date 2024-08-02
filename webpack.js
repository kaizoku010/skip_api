const path = require('path');

module.exports = {
  entry: './server.js', // Path to your main function file
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'netlify/functions'), // Output directory
    filename: 'index.js', // Output filename
  },
  resolve: {
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
    },
  },
};
