module.exports = function PostGraphileUploadFieldPlugin(builder, options) {
  require("./src/UploadFieldPlugin.js")(builder, options);
};