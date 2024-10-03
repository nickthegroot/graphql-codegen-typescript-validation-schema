import { isEnumType, isScalarType } from 'graphql';
import { DeclarationBlock, indent } from '@graphql-codegen/visitor-plugin-common';
import { buildApiForValibot, formatDirectiveConfig } from '../directive.js';
import { InterfaceTypeDefinitionBuilder, isListType, isNamedType, isNonNullType, ObjectTypeDefinitionBuilder, } from '../graphql.js';
import { BaseSchemaVisitor } from '../schema_visitor.js';
export class ValibotSchemaVisitor extends BaseSchemaVisitor {
    constructor(schema, config) {
        super(schema, config);
    }
    importValidationSchema() {
        return `import * as v from 'valibot'`;
    }
    initialEmit() {
        return (`\n${[
            ...this.enumDeclarations,
        ].join('\n')}`);
    }
    get InputObjectTypeDefinition() {
        return {
            leave: (node) => {
                const visitor = this.createVisitor('input');
                const name = visitor.convertName(node.name.value);
                this.importTypes.push(name);
                return this.buildInputFields(node.fields ?? [], visitor, name);
            },
        };
    }
    get InterfaceTypeDefinition() {
        return {
            leave: InterfaceTypeDefinitionBuilder(this.config.withObjectType, (node) => {
                const visitor = this.createVisitor('output');
                const name = visitor.convertName(node.name.value);
                this.importTypes.push(name);
                // Building schema for field arguments.
                const argumentBlocks = this.buildTypeDefinitionArguments(node, visitor);
                const appendArguments = argumentBlocks ? `\n${argumentBlocks}` : '';
                // Building schema for fields.
                const shape = node.fields?.map(field => generateFieldValibotSchema(this.config, visitor, field, 2)).join(',\n');
                switch (this.config.validationSchemaExportType) {
                    default:
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('function')
                            .withName(`${name}Schema(): v.GenericSchema<${name}>`)
                            .withBlock([indent(`return v.object({`), shape, indent('})')].join('\n'))
                            .string + appendArguments);
                }
            }),
        };
    }
    get ObjectTypeDefinition() {
        return {
            leave: ObjectTypeDefinitionBuilder(this.config.withObjectType, (node) => {
                const visitor = this.createVisitor('output');
                const name = visitor.convertName(node.name.value);
                this.importTypes.push(name);
                // Building schema for field arguments.
                const argumentBlocks = this.buildTypeDefinitionArguments(node, visitor);
                const appendArguments = argumentBlocks ? `\n${argumentBlocks}` : '';
                // Building schema for fields.
                const shape = node.fields?.map(field => generateFieldValibotSchema(this.config, visitor, field, 2)).join(',\n');
                switch (this.config.validationSchemaExportType) {
                    default:
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('function')
                            .withName(`${name}Schema(): v.GenericSchema<${name}>`)
                            .withBlock([
                            indent(`return v.object({`),
                            indent(`__typename: v.optional(v.literal('${node.name.value}')),`, 2),
                            shape,
                            indent('})'),
                        ].join('\n'))
                            .string + appendArguments);
                }
            }),
        };
    }
    get EnumTypeDefinition() {
        return {
            leave: (node) => {
                const visitor = this.createVisitor('both');
                const enumname = visitor.convertName(node.name.value);
                this.importTypes.push(enumname);
                // hoist enum declarations
                this.enumDeclarations.push(this.config.enumsAsTypes
                    ? new DeclarationBlock({})
                        .export()
                        .asKind('const')
                        .withName(`${enumname}Schema`)
                        .withContent(`v.picklist([${node.values?.map(enumOption => `'${enumOption.name.value}'`).join(', ')}])`)
                        .string
                    : new DeclarationBlock({})
                        .export()
                        .asKind('const')
                        .withName(`${enumname}Schema`)
                        .withContent(`v.enum_(${enumname})`)
                        .string);
            },
        };
    }
    get UnionTypeDefinition() {
        return {
            leave: (node) => {
                if (!node.types || !this.config.withObjectType)
                    return;
                const visitor = this.createVisitor('output');
                const unionName = visitor.convertName(node.name.value);
                const unionElements = node.types.map((t) => {
                    const element = visitor.convertName(t.name.value);
                    const typ = visitor.getType(t.name.value);
                    if (typ?.astNode?.kind === 'EnumTypeDefinition')
                        return `${element}Schema`;
                    switch (this.config.validationSchemaExportType) {
                        default:
                            return `${element}Schema()`;
                    }
                }).join(', ');
                const unionElementsCount = node.types.length ?? 0;
                const union = unionElementsCount > 1 ? `v.union([${unionElements}])` : unionElements;
                switch (this.config.validationSchemaExportType) {
                    default:
                        return new DeclarationBlock({})
                            .export()
                            .asKind('function')
                            .withName(`${unionName}Schema()`)
                            .withBlock(indent(`return ${union}`))
                            .string;
                }
            },
        };
    }
    buildInputFields(fields, visitor, name) {
        const shape = fields.map(field => generateFieldValibotSchema(this.config, visitor, field, 2)).join(',\n');
        switch (this.config.validationSchemaExportType) {
            default:
                return new DeclarationBlock({})
                    .export()
                    .asKind('function')
                    .withName(`${name}Schema(): v.GenericSchema<${name}>`)
                    .withBlock([indent(`return v.object({`), shape, indent('})')].join('\n'))
                    .string;
        }
    }
}
function generateFieldValibotSchema(config, visitor, field, indentCount) {
    const gen = generateFieldTypeValibotSchema(config, visitor, field, field.type);
    return indent(`${field.name.value}: ${maybeLazy(visitor, field.type, gen)}`, indentCount);
}
function generateFieldTypeValibotSchema(config, visitor, field, type, parentType) {
    if (isListType(type)) {
        const gen = generateFieldTypeValibotSchema(config, visitor, field, type.type, type);
        const arrayGen = `v.array(${maybeLazy(visitor, type.type, gen)})`;
        if (!isNonNullType(parentType))
            return `v.nullish(${arrayGen})`;
        return arrayGen;
    }
    if (isNonNullType(type)) {
        const gen = generateFieldTypeValibotSchema(config, visitor, field, type.type, type);
        return maybeLazy(visitor, type.type, gen);
    }
    if (isNamedType(type)) {
        const gen = generateNameNodeValibotSchema(config, visitor, type.name);
        if (isListType(parentType))
            return `v.nullable(${gen})`;
        const actions = actionsFromDirectives(config, field);
        if (isNonNullType(parentType))
            return pipeSchemaAndActions(gen, actions);
        ;
        return `v.nullish(${pipeSchemaAndActions(gen, actions)})`;
    }
    console.warn('unhandled type:', type);
    return '';
}
function actionsFromDirectives(config, field) {
    if (config.directives && field.directives) {
        const formatted = formatDirectiveConfig(config.directives);
        return buildApiForValibot(formatted, field.directives);
    }
    return [];
}
function pipeSchemaAndActions(schema, actions) {
    if (actions.length === 0)
        return schema;
    return `v.pipe(${schema}, ${actions.join(', ')})`;
}
function generateNameNodeValibotSchema(config, visitor, node) {
    const converter = visitor.getNameNodeConverter(node);
    switch (converter?.targetKind) {
        case 'InterfaceTypeDefinition':
        case 'InputObjectTypeDefinition':
        case 'ObjectTypeDefinition':
        case 'UnionTypeDefinition':
            // using switch-case rather than if-else to allow for future expansion
            switch (config.validationSchemaExportType) {
                default:
                    return `${converter.convertName()}Schema()`;
            }
        case 'EnumTypeDefinition':
            return `${converter.convertName()}Schema`;
        case 'ScalarTypeDefinition':
            return valibot4Scalar(config, visitor, node.value);
        default:
            if (converter?.targetKind)
                console.warn('Unknown targetKind', converter?.targetKind);
            return valibot4Scalar(config, visitor, node.value);
    }
}
function maybeLazy(visitor, type, schema) {
    if (!isNamedType(type)) {
        return schema;
    }
    const schemaType = visitor.getType(type.name.value);
    const isComplexType = !isScalarType(schemaType) && !isEnumType(schemaType);
    return isComplexType ? `v.lazy(() => ${schema})` : schema;
}
function valibot4Scalar(config, visitor, scalarName) {
    if (config.scalarSchemas?.[scalarName])
        return config.scalarSchemas[scalarName];
    const tsType = visitor.getScalarType(scalarName);
    switch (tsType) {
        case 'string':
            return `v.string()`;
        case 'number':
            return `v.number()`;
        case 'boolean':
            return `v.boolean()`;
    }
    console.warn('unhandled scalar name:', scalarName);
    return 'v.any()';
}