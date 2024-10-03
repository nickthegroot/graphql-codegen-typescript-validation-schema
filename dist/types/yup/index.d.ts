import type { EnumTypeDefinitionNode, FieldDefinitionNode, GraphQLSchema, InputObjectTypeDefinitionNode, InputValueDefinitionNode, InterfaceTypeDefinitionNode, ObjectTypeDefinitionNode, UnionTypeDefinitionNode } from 'graphql';
import type { ValidationSchemaPluginConfig } from '../config.js';
import type { Visitor } from '../visitor.js';
import { BaseSchemaVisitor } from '../schema_visitor.js';
export declare class YupSchemaVisitor extends BaseSchemaVisitor {
    constructor(schema: GraphQLSchema, config: ValidationSchemaPluginConfig);
    importValidationSchema(): string;
    initialEmit(): string;
    get InputObjectTypeDefinition(): {
        leave: (node: InputObjectTypeDefinitionNode) => string;
    };
    get InterfaceTypeDefinition(): {
        leave: ((node: InterfaceTypeDefinitionNode) => any) | undefined;
    };
    get ObjectTypeDefinition(): {
        leave: ((node: ObjectTypeDefinitionNode) => any) | undefined;
    };
    get EnumTypeDefinition(): {
        leave: (node: EnumTypeDefinitionNode) => void;
    };
    get UnionTypeDefinition(): {
        leave: (node: UnionTypeDefinitionNode) => string | undefined;
    };
    protected buildInputFields(fields: readonly (FieldDefinitionNode | InputValueDefinitionNode)[], visitor: Visitor, name: string): string;
}
