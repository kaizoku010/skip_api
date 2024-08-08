const path = require('path');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  target: 'node', // Ensure Webpack is targeting Node.js environment
  entry: './server.js',
  output: {
    path: path.resolve(__dirname, 'dist'), // Change output directory to 'dist'
    filename: 'bundle.js',
    libraryTarget: 'commonjs2' // Ensure compatibility with Node.js
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
      "fs": false, // Exclude fs as it's a core module not available in browser
      "http": require.resolve("stream-http"),
      "crypto": require.resolve("crypto-browserify"),
      "zlib": require.resolve("browserify-zlib"),
      "net": false,
      "async_hooks": false,
      "vm": false,
      "events": require.resolve("events"),
      "util": require.resolve("util")
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new NodePolyfillPlugin()
  ],
  externals: [nodeExternals()] // Exclude node_modules from the bundle
};
