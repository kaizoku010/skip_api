const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './server.js',
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  },
  resolve: {
    fallback: {
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "fs": require.resolve("browserify-fs"),
      "http": require.resolve("stream-http"),
      "crypto": require.resolve("crypto-browserify"),
      "zlib": require.resolve("browserify-zlib")
      
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ]
};
