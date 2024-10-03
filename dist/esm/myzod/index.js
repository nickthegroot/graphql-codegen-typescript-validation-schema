import { resolveExternalModuleAndFn } from '@graphql-codegen/plugin-helpers';
import { convertNameParts, DeclarationBlock, indent } from '@graphql-codegen/visitor-plugin-common';
import { isEnumType, isScalarType, Kind, } from 'graphql';
import { buildApi, formatDirectiveConfig } from '../directive.js';
import { escapeGraphQLCharacters, InterfaceTypeDefinitionBuilder, isListType, isNamedType, isNonNullType, ObjectTypeDefinitionBuilder, } from '../graphql.js';
import { BaseSchemaVisitor } from '../schema_visitor.js';
const anySchema = `definedNonNullAnySchema`;
export class MyZodSchemaVisitor extends BaseSchemaVisitor {
    constructor(schema, config) {
        super(schema, config);
    }
    importValidationSchema() {
        return `import * as myzod from 'myzod'`;
    }
    initialEmit() {
        return (`\n${[
            new DeclarationBlock({}).export().asKind('const').withName(`${anySchema}`).withContent(`myzod.object({})`).string,
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
                const shape = node.fields?.map(field => generateFieldMyZodSchema(this.config, visitor, field, 2)).join(',\n');
                switch (this.config.validationSchemaExportType) {
                    case 'const':
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('const')
                            .withName(`${name}Schema: myzod.Type<${name}>`)
                            .withContent([`myzod.object({`, shape, '})'].join('\n'))
                            .string + appendArguments);
                    case 'function':
                    default:
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('function')
                            .withName(`${name}Schema(): myzod.Type<${name}>`)
                            .withBlock([indent(`return myzod.object({`), shape, indent('})')].join('\n'))
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
                const shape = node.fields?.map(field => generateFieldMyZodSchema(this.config, visitor, field, 2)).join(',\n');
                switch (this.config.validationSchemaExportType) {
                    case 'const':
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('const')
                            .withName(`${name}Schema: myzod.Type<${name}>`)
                            .withContent([
                            `myzod.object({`,
                            indent(`__typename: myzod.literal('${node.name.value}').optional(),`, 2),
                            shape,
                            '})',
                        ].join('\n'))
                            .string + appendArguments);
                    case 'function':
                    default:
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('function')
                            .withName(`${name}Schema(): myzod.Type<${name}>`)
                            .withBlock([
                            indent(`return myzod.object({`),
                            indent(`__typename: myzod.literal('${node.name.value}').optional(),`, 2),
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
                // z.enum are basically myzod.literals
                // hoist enum declarations
                this.enumDeclarations.push(this.config.enumsAsTypes
                    ? new DeclarationBlock({})
                        .export()
                        .asKind('type')
                        .withName(`${enumname}Schema`)
                        .withContent(`myzod.literals(${node.values?.map(enumOption => `'${enumOption.name.value}'`).join(', ')})`)
                        .string
                    : new DeclarationBlock({})
                        .export()
                        .asKind('const')
                        .withName(`${enumname}Schema`)
                        .withContent(`myzod.enum(${enumname})`)
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
                const unionElements = node.types?.map((t) => {
                    const element = visitor.convertName(t.name.value);
                    const typ = visitor.getType(t.name.value);
                    if (typ?.astNode?.kind === 'EnumTypeDefinition')
                        return `${element}Schema`;
                    switch (this.config.validationSchemaExportType) {
                        case 'const':
                            return `${element}Schema`;
                        case 'function':
                        default:
                            return `${element}Schema()`;
                    }
                }).join(', ');
                const unionElementsCount = node.types?.length ?? 0;
                const union = unionElementsCount > 1 ? `myzod.union([${unionElements}])` : unionElements;
                switch (this.config.validationSchemaExportType) {
                    case 'const':
                        return new DeclarationBlock({}).export().asKind('const').withName(`${unionName}Schema`).withContent(union).string;
                    case 'function':
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
        const shape = fields.map(field => generateFieldMyZodSchema(this.config, visitor, field, 2)).join(',\n');
        switch (this.config.validationSchemaExportType) {
            case 'const':
                return new DeclarationBlock({})
                    .export()
                    .asKind('const')
                    .withName(`${name}Schema: myzod.Type<${name}>`)
                    .withContent(['myzod.object({', shape, '})'].join('\n'))
                    .string;
            case 'function':
            default:
                return new DeclarationBlock({})
                    .export()
                    .asKind('function')
                    .withName(`${name}Schema(): myzod.Type<${name}>`)
                    .withBlock([indent(`return myzod.object({`), shape, indent('})')].join('\n'))
                    .string;
        }
    }
}
function generateFieldMyZodSchema(config, visitor, field, indentCount) {
    const gen = generateFieldTypeMyZodSchema(config, visitor, field, field.type);
    return indent(`${field.name.value}: ${maybeLazy(visitor, field.type, gen)}`, indentCount);
}
function generateFieldTypeMyZodSchema(config, visitor, field, type, parentType) {
    if (isListType(type)) {
        const gen = generateFieldTypeMyZodSchema(config, visitor, field, type.type, type);
        if (!isNonNullType(parentType)) {
            const arrayGen = `myzod.array(${maybeLazy(visitor, type.type, gen)})`;
            const maybeLazyGen = applyDirectives(config, field, arrayGen);
            return `${maybeLazyGen}.optional().nullable()`;
        }
        return `myzod.array(${maybeLazy(visitor, type.type, gen)})`;
    }
    if (isNonNullType(type)) {
        const gen = generateFieldTypeMyZodSchema(config, visitor, field, type.type, type);
        return maybeLazy(visitor, type.type, gen);
    }
    if (isNamedType(type)) {
        const gen = generateNameNodeMyZodSchema(config, visitor, type.name);
        if (isListType(parentType))
            return `${gen}.nullable()`;
        let appliedDirectivesGen = applyDirectives(config, field, gen);
        if (field.kind === Kind.INPUT_VALUE_DEFINITION) {
            const { defaultValue } = field;
            if (defaultValue?.kind === Kind.INT || defaultValue?.kind === Kind.FLOAT || defaultValue?.kind === Kind.BOOLEAN)
                appliedDirectivesGen = `${appliedDirectivesGen}.default(${defaultValue.value})`;
            if (defaultValue?.kind === Kind.STRING || defaultValue?.kind === Kind.ENUM) {
                if (config.useEnumTypeAsDefaultValue && defaultValue?.kind !== Kind.STRING) {
                    let value = convertNameParts(defaultValue.value, resolveExternalModuleAndFn('change-case-all#pascalCase'));
                    if (config.namingConvention?.enumValues)
                        value = convertNameParts(defaultValue.value, resolveExternalModuleAndFn(config.namingConvention?.enumValues));
                    appliedDirectivesGen = `${appliedDirectivesGen}.default(${visitor.convertName(type.name.value)}.${value})`;
                }
                else {
                    appliedDirectivesGen = `${appliedDirectivesGen}.default("${escapeGraphQLCharacters(defaultValue.value)}")`;
                }
            }
        }
        if (isNonNullType(parentType)) {
            if (visitor.shouldEmitAsNotAllowEmptyString(type.name.value))
                return `${gen}.min(1)`;
            return appliedDirectivesGen;
        }
        if (isListType(parentType))
            return `${appliedDirectivesGen}.nullable()`;
        return `${appliedDirectivesGen}.optional().nullable()`;
    }
    console.warn('unhandled type:', type);
    return '';
}
function applyDirectives(config, field, gen) {
    if (config.directives && field.directives) {
        const formatted = formatDirectiveConfig(config.directives);
        return gen + buildApi(formatted, field.directives);
    }
    return gen;
}
function generateNameNodeMyZodSchema(config, visitor, node) {
    const converter = visitor.getNameNodeConverter(node);
    switch (converter?.targetKind) {
        case 'InterfaceTypeDefinition':
        case 'InputObjectTypeDefinition':
        case 'ObjectTypeDefinition':
        case 'UnionTypeDefinition':
            // using switch-case rather than if-else to allow for future expansion
            switch (config.validationSchemaExportType) {
                case 'const':
                    return `${converter.convertName()}Schema`;
                case 'function':
                default:
                    return `${converter.convertName()}Schema()`;
            }
        case 'EnumTypeDefinition':
            return `${converter.convertName()}Schema`;
        case 'ScalarTypeDefinition':
            return myzod4Scalar(config, visitor, node.value);
        default:
            if (converter?.targetKind)
                console.warn('Unknown target kind', converter.targetKind);
            return myzod4Scalar(config, visitor, node.value);
    }
}
function maybeLazy(visitor, type, schema) {
    if (!isNamedType(type)) {
        return schema;
    }
    const schemaType = visitor.getType(type.name.value);
    const isComplexType = !isScalarType(schemaType) && !isEnumType(schemaType);
    return isComplexType ? `myzod.lazy(() => ${schema})` : schema;
}
function myzod4Scalar(config, visitor, scalarName) {
    if (config.scalarSchemas?.[scalarName])
        return config.scalarSchemas[scalarName];
    const tsType = visitor.getScalarType(scalarName);
    switch (tsType) {
        case 'string':
            return `myzod.string()`;
        case 'number':
            return `myzod.number()`;
        case 'boolean':
            return `myzod.boolean()`;
    }
    console.warn('unhandled name:', scalarName);
    return anySchema;
}