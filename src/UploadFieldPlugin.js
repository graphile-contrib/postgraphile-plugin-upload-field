module.exports = function UploadFieldPlugin(
  builder,
  { uploadFieldDefinitions }
) {
  const findMatchingDefinitions = (def, table, attr) =>
    def.match({
      schema: table.namespaceName,
      table: table.name,
      column: attr.name,
      tags: attr.tags
    });

  builder.hook("build", (_, build, context) => {
    const { addType, graphql: { GraphQLScalarType } } = build;

    const GraphQLUpload = new GraphQLScalarType({
      name: "Upload",
      description:
        "The `Upload` scalar type represents a file upload promise that resolves " +
        "an object containing `stream`, `filename`, `mimetype` and `encoding`.",
      parseValue: value => value,
      parseLiteral() {
        throw new Error("Upload scalar literal unsupported");
      },
      serialize() {
        throw new Error("Upload scalar serialization unsupported");
      }
    });

    addType(GraphQLUpload);

    return _;
  });

  builder.hook(
    "GraphQLInputObjectType:fields:field",
    (field, build, context) => {
      const {
        getTypeByName,
        pgIntrospectionResultsByKind: introspectionResultsByKind,
        inflection
      } = build;
      const {
        scope: {
          isPgRowType,
          fieldName,
          pgIntrospection: table,
          pgFieldIntrospection: attr
        }
      } = context;

      if (!table) {
        return field;
      }

      const foundUploadFieldDefinition =
        introspectionResultsByKind.attribute
          .filter(attr => attr.classId === table.id)
          .filter(attr => {
            const attrFieldName = inflection.column(attr);
            return fieldName === attrFieldName;
          })
          .filter(
            attr =>
              uploadFieldDefinitions.filter(def => findMatchingDefinitions(def, table, attr))
                .length === 1
          ).length === 1;

      if (foundUploadFieldDefinition) {
        return Object.assign({}, field, {
          type: getTypeByName("Upload")
        });
      }

      return field;
    }
  );

  builder.hook("GraphQLObjectType:fields:field", (field, build, context) => {
    const {
      pgGetGqlTypeByTypeId,
      pgGetGqlInputTypeByTypeId,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      inflection
    } = build;
    const {
      scope: { isRootMutation, fieldName, pgFieldIntrospection: table }
    } = context;
    if (!isRootMutation || !table) {
      return field;
    }

    // It's possible that `resolve` isn't specified on a field, so in that case
    // we fall back to a default resolver.
    const defaultResolver = obj => obj[fieldName];

    // Extract the old resolver from `field`
    const { resolve: oldResolve = defaultResolver, ...rest } = field;

    const uploadResolversByFieldName = introspectionResultsByKind.attribute
      .filter(attr => attr.classId === table.id)
      .reduce((memo, attr) => {
        const defs = uploadFieldDefinitions.filter(def =>
          findMatchingDefinitions(def, table, attr)
        );
        if (defs.length > 1) {
          throw new Error("Upload field definitions are ambiguous");
        }
        if (defs.length === 1) {
          const fieldName = inflection.column(attr);
          memo[fieldName] = defs[0].resolve;
        }
        return memo;
      }, {});

    return {
      // Copy over everything except 'resolve'
      ...rest,

      // Add our new resolver which wraps the old resolver
      async resolve(source, args, context, info) {
        // Recursively check for Upload promises to resolve
        async function resolvePromises(obj) {
          for (let key of Object.keys(obj)) {
            if (obj[key] instanceof Promise) {
              if (uploadResolversByFieldName[key]) {
                const upload = await obj[key];
                obj[key] = await uploadResolversByFieldName[key](upload, args);
              }
            } else if (obj[key] !== null && typeof obj[key] === "object") {
              await resolvePromises(obj[key]);
            }
          }
        }
        await resolvePromises(args);
        // Call the old resolver
        const oldResolveResult = await oldResolve(source, args, context, info);
        // Finally return the result.
        return oldResolveResult;
      }
    };
  });
};
