const core = require("./core");

test(
  "prints a schema with the upload field plugin",
  core.test(["p"], {
    appendPlugins: [require("../../../index.js")],
    graphileBuildOptions: {
      uploadFieldDefinitions: [
        {
          match: ({ column }) => column === "header_image_file",
          resolve: async function resolveUpload() {
            //const { filename, createReadStream } = upload;
            //const stream = createReadStream();
            // Save file to the local filesystem
            //const { filepath } = await saveLocal({ stream, filename });
            // Return metadata to save it to Postgres
            //return filepath;
            return "TEST";
          },
        },
      ],
    },
  })
);
