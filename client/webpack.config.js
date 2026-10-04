const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const DotenvWebpack = require('dotenv-webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');

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
            { loader: 'css-loader', options: { esModule: false, modules: { localIdentName: isDev ? '[local]__[hash:base64:5]' : '[local]_[hash:base64:5]' } } },
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
      // ignoreOrder: стили — CSS-модули с уникальными классами, порядок их подключения в чанках
      // не влияет на результат, а предупреждения «Conflicting order» после разбиения компонентов — шум
      ...(!isDev ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash].css', ignoreOrder: true })] : []),
      // Манифест PWA, иконки и favicon — как есть, в корень сборки
      new CopyWebpackPlugin({
        patterns: [{ from: 'public', to: '.', globOptions: { ignore: ['**/index.html'] } }],
      }),
      // Service worker — только в продакшене: в разработке кеш мешал бы горячей перезагрузке
      ...(!isDev ? [new InjectManifest({
        swSrc: './src/sw.ts',
        swDest: 'sw.js',
        // Все чанки приложения (в том числе ленивые страницы) — в кеш при установке
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        exclude: [/\.map$/, /\.LICENSE\.txt$/],
      })] : []),
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
