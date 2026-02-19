/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

const isDev = process.env.NODE_ENV !== "production";

module.exports = {
  entry: {
    taskpane: "./src/taskpane/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash:8].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpg|jpeg|gif|ico|svg)$/,
        type: "asset/resource",
        generator: {
          filename: "assets/[name][ext]",
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/taskpane/taskpane.html",
      filename: "taskpane.html",
      chunks: ["taskpane"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "manifest.xml", to: "manifest.xml" },
        { from: "assets", to: "assets", noErrorOnMissing: true },
      ],
    }),
    new webpack.DefinePlugin({
      "process.env.CONTIGO_API_URL": JSON.stringify(
        process.env.CONTIGO_API_URL || (isDev ? "http://localhost:3005/api" : "https://contigo.app/api")
      ),
    }),
  ],
  devServer: {
    port: 3006,
    https: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    static: {
      directory: path.join(__dirname, "dist"),
    },
    hot: true,
  },
  devtool: isDev ? "source-map" : false,
};
