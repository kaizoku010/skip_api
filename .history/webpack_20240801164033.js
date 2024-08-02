const path = require('path');

module.exports = {
  entry: './functions/api.js', // Change this to your main function file
  target: 'node', // Target Node.js
  output: {
    path: path.resolve(__dirname, 'functions-build'), // Output directory
    filename: 'index.js', // Output file name
  },
  resolve: {
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
    },
  },
};