import type { FieldDefinitionNode, GraphQLSchema, InterfaceTypeDefinitionNode, NameNode, ObjectTypeDefinitionNode } from 'graphql';
import type { ValidationSchemaPluginConfig } from './config.js';
import { TsVisitor } from '@graphql-codegen/typescript';
export declare class Visitor extends TsVisitor {
    private scalarDirection;
    private schema;
    private pluginConfig;
    constructor(scalarDirection: 'input' | 'output' | 'both', schema: GraphQLSchema, pluginConfig: ValidationSchemaPluginConfig);
    private isSpecifiedScalarName;
    getType(name: string): import("graphql").GraphQLNamedType | undefined;
    getNameNodeConverter(node: NameNode): {
        targetKind: import("graphql").Kind.SCALAR_TYPE_DEFINITION | import("graphql").Kind.OBJECT_TYPE_DEFINITION | import("graphql").Kind.INTERFACE_TYPE_DEFINITION | import("graphql").Kind.UNION_TYPE_DEFINITION | import("graphql").Kind.ENUM_TYPE_DEFINITION | import("graphql").Kind.INPUT_OBJECT_TYPE_DEFINITION;
        convertName: () => string;
    } | undefined;
    getScalarType(scalarName: string): string | null;
    shouldEmitAsNotAllowEmptyString(name: string): boolean;
    buildArgumentsSchemaBlock(node: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode, callback: (typeName: string, field: FieldDefinitionNode) => string): string | undefined;
}
