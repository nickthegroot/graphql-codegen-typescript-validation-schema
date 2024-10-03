import { resolveExternalModuleAndFn } from '@graphql-codegen/plugin-helpers';
import { convertNameParts, DeclarationBlock, indent } from '@graphql-codegen/visitor-plugin-common';
import { isEnumType, isScalarType, Kind, } from 'graphql';
import { buildApi, formatDirectiveConfig } from '../directive.js';
import { escapeGraphQLCharacters, InterfaceTypeDefinitionBuilder, isListType, isNamedType, isNonNullType, ObjectTypeDefinitionBuilder, } from '../graphql.js';
import { BaseSchemaVisitor } from '../schema_visitor.js';
export class YupSchemaVisitor extends BaseSchemaVisitor {
    constructor(schema, config) {
        super(schema, config);
    }
    importValidationSchema() {
        return `import * as yup from 'yup'`;
    }
    initialEmit() {
        if (!this.config.withObjectType)
            return `\n${this.enumDeclarations.join('\n')}`;
        return (`\n${this.enumDeclarations.join('\n')}\n${new DeclarationBlock({})
            .asKind('function')
            .withName('union<T extends {}>(...schemas: ReadonlyArray<yup.Schema<T>>): yup.MixedSchema<T>')
            .withBlock([
            indent('return yup.mixed<T>().test({'),
            indent('test: (value) => schemas.some((schema) => schema.isValidSync(value))', 2),
            indent('}).defined()'),
        ].join('\n'))
            .string}`);
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
                const shape = node.fields?.map((field) => {
                    const fieldSchema = generateFieldYupSchema(this.config, visitor, field, 2);
                    return isNonNullType(field.type) ? fieldSchema : `${fieldSchema}.optional()`;
                }).join(',\n');
                switch (this.config.validationSchemaExportType) {
                    case 'const':
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('const')
                            .withName(`${name}Schema: yup.ObjectSchema<${name}>`)
                            .withContent([`yup.object({`, shape, '})'].join('\n'))
                            .string + appendArguments);
                    case 'function':
                    default:
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('function')
                            .withName(`${name}Schema(): yup.ObjectSchema<${name}>`)
                            .withBlock([indent(`return yup.object({`), shape, indent('})')].join('\n'))
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
                const shape = shapeFields(node.fields, this.config, visitor);
                switch (this.config.validationSchemaExportType) {
                    case 'const':
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('const')
                            .withName(`${name}Schema: yup.ObjectSchema<${name}>`)
                            .withContent([
                            `yup.object({`,
                            indent(`__typename: yup.string<'${node.name.value}'>().optional(),`, 2),
                            shape,
                            '})',
                        ].join('\n'))
                            .string + appendArguments);
                    case 'function':
                    default:
                        return (new DeclarationBlock({})
                            .export()
                            .asKind('function')
                            .withName(`${name}Schema(): yup.ObjectSchema<${name}>`)
                            .withBlock([
                            indent(`return yup.object({`),
                            indent(`__typename: yup.string<'${node.name.value}'>().optional(),`, 2),
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
                // hoise enum declarations
                if (this.config.enumsAsTypes) {
                    const enums = node.values?.map(enumOption => `'${enumOption.name.value}'`);
                    this.enumDeclarations.push(new DeclarationBlock({})
                        .export()
                        .asKind('const')
                        .withName(`${enumname}Schema`)
                        .withContent(`yup.string().oneOf([${enums?.join(', ')}]).defined()`).string);
                }
                else {
                    this.enumDeclarations.push(new DeclarationBlock({})
                        .export()
                        .asKind('const')
                        .withName(`${enumname}Schema`)
                        .withContent(`yup.string<${enumname}>().oneOf(Object.values(${enumname})).defined()`).string);
                }
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
                this.importTypes.push(unionName);
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
                switch (this.config.validationSchemaExportType) {
                    case 'const':
                        return new DeclarationBlock({})
                            .export()
                            .asKind('const')
                            .withName(`${unionName}Schema: yup.MixedSchema<${unionName}>`)
                            .withContent(`union<${unionName}>(${unionElements})`)
                            .string;
                    case 'function':
                    default:
                        return new DeclarationBlock({})
                            .export()
                            .asKind('function')
                            .withName(`${unionName}Schema(): yup.MixedSchema<${unionName}>`)
                            .withBlock(indent(`return union<${unionName}>(${unionElements})`))
                            .string;
                }
            },
        };
    }
    buildInputFields(fields, visitor, name) {
        const shape = shapeFields(fields, this.config, visitor);
        switch (this.config.validationSchemaExportType) {
            case 'const':
                return new DeclarationBlock({})
                    .export()
                    .asKind('const')
                    .withName(`${name}Schema: yup.ObjectSchema<${name}>`)
                    .withContent(['yup.object({', shape, '})'].join('\n'))
                    .string;
            case 'function':
            default:
                return new DeclarationBlock({})
                    .export()
                    .asKind('function')
                    .withName(`${name}Schema(): yup.ObjectSchema<${name}>`)
                    .withBlock([indent(`return yup.object({`), shape, indent('})')].join('\n'))
                    .string;
        }
    }
}
function shapeFields(fields, config, visitor) {
    return fields
        ?.map((field) => {
        let fieldSchema = generateFieldYupSchema(config, visitor, field, 2);
        if (field.kind === Kind.INPUT_VALUE_DEFINITION) {
            const { defaultValue } = field;
            if (defaultValue?.kind === Kind.INT
                || defaultValue?.kind === Kind.FLOAT
                || defaultValue?.kind === Kind.BOOLEAN) {
                fieldSchema = `${fieldSchema}.default(${defaultValue.value})`;
            }
            if (defaultValue?.kind === Kind.STRING || defaultValue?.kind === Kind.ENUM) {
                if (config.useEnumTypeAsDefaultValue && defaultValue?.kind !== Kind.STRING) {
                    let value = convertNameParts(defaultValue.value, resolveExternalModuleAndFn('change-case-all#pascalCase'));
                    if (config.namingConvention?.enumValues)
                        value = convertNameParts(defaultValue.value, resolveExternalModuleAndFn(config.namingConvention?.enumValues));
                    fieldSchema = `${fieldSchema}.default(${visitor.convertName(field.name.value)}.${value})`;
                }
                else {
                    fieldSchema = `${fieldSchema}.default("${escapeGraphQLCharacters(defaultValue.value)}")`;
                }
            }
        }
        if (isNonNullType(field.type))
            return fieldSchema;
        return `${fieldSchema}.optional()`;
    })
        .join(',\n');
}
function generateFieldYupSchema(config, visitor, field, indentCount) {
    let gen = generateFieldTypeYupSchema(config, visitor, field.type);
    if (config.directives && field.directives) {
        const formatted = formatDirectiveConfig(config.directives);
        gen += buildApi(formatted, field.directives);
    }
    return indent(`${field.name.value}: ${maybeLazy(visitor, field.type, gen)}`, indentCount);
}
function generateFieldTypeYupSchema(config, visitor, type, parentType) {
    if (isListType(type)) {
        const gen = generateFieldTypeYupSchema(config, visitor, type.type, type);
        if (!isNonNullType(parentType))
            return `yup.array(${maybeLazy(visitor, type.type, gen)}).defined().nullable()`;
        return `yup.array(${maybeLazy(visitor, type.type, gen)}).defined()`;
    }
    if (isNonNullType(type)) {
        const gen = generateFieldTypeYupSchema(config, visitor, type.type, type);
        return maybeLazy(visitor, type.type, gen);
    }
    if (isNamedType(type)) {
        const gen = generateNameNodeYupSchema(config, visitor, type.name);
        if (isNonNullType(parentType)) {
            if (visitor.shouldEmitAsNotAllowEmptyString(type.name.value))
                return `${gen}.required()`;
            return `${gen}.nonNullable()`;
        }
        const typ = visitor.getType(type.name.value);
        if (typ?.astNode?.kind === 'InputObjectTypeDefinition')
            return `${gen}`;
        return `${gen}.nullable()`;
    }
    console.warn('unhandled type:', type);
    return '';
}
function generateNameNodeYupSchema(config, visitor, node) {
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
        default:
            return yup4Scalar(config, visitor, node.value);
    }
}
function maybeLazy(visitor, type, schema) {
    if (!isNamedType(type)) {
        return schema;
    }
    const schemaType = visitor.getType(type.name.value);
    const isComplexType = !isScalarType(schemaType) && !isEnumType(schemaType);
    return isComplexType ? `yup.lazy(() => ${schema})` : schema;
}
function yup4Scalar(config, visitor, scalarName) {
    if (config.scalarSchemas?.[scalarName])
        return `${config.scalarSchemas[scalarName]}.defined()`;
    const tsType = visitor.getScalarType(scalarName);
    switch (tsType) {
        case 'string':
            return `yup.string().defined()`;
        case 'number':
            return `yup.number().defined()`;
        case 'boolean':
            return `yup.boolean().defined()`;
    }
    console.warn('unhandled name:', scalarName);
    return `yup.mixed()`;
}