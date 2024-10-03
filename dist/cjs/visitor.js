"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Visitor = void 0;
const typescript_1 = require("@graphql-codegen/typescript");
const graphql_1 = require("graphql");
class Visitor extends typescript_1.TsVisitor {
    scalarDirection;
    schema;
    pluginConfig;
    constructor(scalarDirection, schema, pluginConfig) {
        super(schema, pluginConfig);
        this.scalarDirection = scalarDirection;
        this.schema = schema;
        this.pluginConfig = pluginConfig;
    }
    isSpecifiedScalarName(scalarName) {
        return graphql_1.specifiedScalarTypes.some(({ name }) => name === scalarName);
    }
    getType(name) {
        return this.schema.getType(name);
    }
    getNameNodeConverter(node) {
        const typ = this.schema.getType(node.value);
        const astNode = typ?.astNode;
        if (astNode === undefined || astNode === null)
            return undefined;
        return {
            targetKind: astNode.kind,
            convertName: () => this.convertName(astNode.name.value),
        };
    }
    getScalarType(scalarName) {
        if (this.scalarDirection === 'both')
            return null;
        const scalar = this.scalars[scalarName];
        if (!scalar)
            throw new Error(`Unknown scalar ${scalarName}`);
        return scalar[this.scalarDirection];
    }
    shouldEmitAsNotAllowEmptyString(name) {
        if (this.pluginConfig.notAllowEmptyString !== true)
            return false;
        const typ = this.getType(name);
        if (typ?.astNode?.kind !== 'ScalarTypeDefinition' && !this.isSpecifiedScalarName(name))
            return false;
        const tsType = this.getScalarType(name);
        return tsType === 'string';
    }
    buildArgumentsSchemaBlock(node, callback) {
        const fieldsWithArguments = node.fields?.filter(field => field.arguments && field.arguments.length > 0) ?? [];
        if (fieldsWithArguments.length === 0)
            return undefined;
        return fieldsWithArguments
            .map((field) => {
            const name = `${this.convertName(node.name.value)
                + (this.config.addUnderscoreToArgsType ? '_' : '')
                + this.convertName(field, {
                    useTypesPrefix: false,
                    useTypesSuffix: false,
                })}Args`;
            return callback(name, field);
        })
            .join('\n');
    }
}
exports.Visitor = Visitor;
