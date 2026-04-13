const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const DotenvWebpack = require('dotenv-webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env = {}) => {
  const isDev = env.NODE_ENV !== 'production';

  return {
    mode: isDev ? 'development' : 'production',
    entry: './src/main.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash].js',
      publicPath: '/',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
              plugins: ['@babel/plugin-transform-runtime'],
            },
          },
        },
        {
          test: /\.module\.scss$/,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            { loader: 'css-loader', options: { modules: { localIdentName: isDev ? '[local]__[hash:base64:5]' : '[hash:base64:8]' } } },
            'sass-loader',
          ],
        },
        {
          test: /\.scss$/,
          exclude: /\.module\.scss$/,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            'css-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.css$/,
          use: [isDev ? 'style-loader' : MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html' }),
      new DotenvWebpack({ path: `./.env.${isDev ? 'development' : 'production'}` }),
      ...(!isDev ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })] : []),
    ],
    devServer: {
      port: 3000,
      historyApiFallback: true,
      hot: true,
      proxy: [
        {
          context: ['/api'],
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      ],
    },
    devtool: isDev ? 'eval-source-map' : false,
    optimization: isDev ? {} : {
      splitChunks: { chunks: 'all' },
    },
  };
};
