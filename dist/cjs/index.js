"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
const schema_ast_1 = require("@graphql-codegen/schema-ast");
const graphql_1 = require("graphql");
const graphql_js_1 = require("./graphql.js");
const index_js_1 = require("./myzod/index.js");
const index_js_2 = require("./valibot/index.js");
const index_js_3 = require("./yup/index.js");
const index_js_4 = require("./zod/index.js");
const plugin = (schema, _documents, config) => {
    const { schema: _schema, ast } = _transformSchemaAST(schema, config);
    const visitor = schemaVisitor(_schema, config);
    const result = (0, graphql_1.visit)(ast, visitor);
    const generated = result.definitions.filter(def => typeof def === 'string');
    return {
        prepend: visitor.buildImports(),
        content: [visitor.initialEmit(), ...generated].join('\n'),
    };
};
exports.plugin = plugin;
function schemaVisitor(schema, config) {
    if (config?.schema === 'zod')
        return new index_js_4.ZodSchemaVisitor(schema, config);
    else if (config?.schema === 'myzod')
        return new index_js_1.MyZodSchemaVisitor(schema, config);
    else if (config?.schema === 'valibot')
        return new index_js_2.ValibotSchemaVisitor(schema, config);
    return new index_js_3.YupSchemaVisitor(schema, config);
}
function _transformSchemaAST(schema, config) {
    const { schema: _schema, ast } = (0, schema_ast_1.transformSchemaAST)(schema, config);
    // See: https://github.com/Code-Hex/graphql-codegen-typescript-validation-schema/issues/394
    const __schema = (0, graphql_js_1.isGeneratedByIntrospection)(_schema) ? (0, graphql_1.buildSchema)((0, graphql_1.printSchema)(_schema)) : _schema;
    // This affects the performance of code generation, so it is
    // enabled only when this option is selected.
    if (config.validationSchemaExportType === 'const') {
        return {
            schema: __schema,
            ast: (0, graphql_js_1.topologicalSortAST)(__schema, ast),
        };
    }
    return {
        schema: __schema,
        ast,
    };
}
