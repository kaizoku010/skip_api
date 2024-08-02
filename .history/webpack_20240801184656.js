const path = require('path');

module.exports = {
  entry: './functions/api.js', // Ensure this points to your function entry file
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'functions-build'), // Output directory for functions
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
