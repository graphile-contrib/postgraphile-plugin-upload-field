module.exports = function PostGraphileDerivedFieldPlugin(builder, options) {
  require("./src/UploadFieldPlugin.js")(builder, options);
};