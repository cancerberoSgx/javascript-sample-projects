const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
module.exports = {
  entry: { app: './src/index.ts' },
  plugins: [
    new CleanWebpackPlugin(['docs']),
    new HtmlWebpackPlugin({
      template: 'src/index.html'
    })
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'docs')
  }
};
