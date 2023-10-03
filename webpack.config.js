const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  target: 'node',
  mode: 'production',
  entry: './index.js',  // Entry point of your lambda function
  externals: [nodeExternals({
    allowlist: ['firebase-admin']
  })],
  output: {
    path: path.resolve(__dirname, '.webpack'),
    filename: 'handler.js',
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
};