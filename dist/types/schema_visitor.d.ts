import type { FieldDefinitionNode, GraphQLSchema, InputValueDefinitionNode, InterfaceTypeDefinitionNode, ObjectTypeDefinitionNode } from 'graphql';
import type { ValidationSchemaPluginConfig } from './config.js';
import type { SchemaVisitor } from './types.js';
import { Visitor } from './visitor.js';
export declare abstract class BaseSchemaVisitor implements SchemaVisitor {
    protected schema: GraphQLSchema;
    protected config: ValidationSchemaPluginConfig;
    protected importTypes: string[];
    protected enumDeclarations: string[];
    constructor(schema: GraphQLSchema, config: ValidationSchemaPluginConfig);
    abstract importValidationSchema(): string;
    buildImports(): string[];
    abstract initialEmit(): string;
    createVisitor(scalarDirection: 'input' | 'output' | 'both'): Visitor;
    protected abstract buildInputFields(fields: readonly (FieldDefinitionNode | InputValueDefinitionNode)[], visitor: Visitor, name: string): string;
    protected buildTypeDefinitionArguments(node: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode, visitor: Visitor): string | undefined;
}
