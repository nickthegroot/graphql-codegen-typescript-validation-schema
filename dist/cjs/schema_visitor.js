"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseSchemaVisitor = void 0;
const visitor_js_1 = require("./visitor.js");
class BaseSchemaVisitor {
    schema;
    config;
    importTypes = [];
    enumDeclarations = [];
    constructor(schema, config) {
        this.schema = schema;
        this.config = config;
    }
    buildImports() {
        if (this.config.importFrom && this.importTypes.length > 0) {
            return [
                this.importValidationSchema(),
                `import ${this.config.useTypeImports ? 'type ' : ''}{ ${this.importTypes.join(', ')} } from '${this.config.importFrom}'`,
            ];
        }
        return [this.importValidationSchema()];
    }
    createVisitor(scalarDirection) {
        return new visitor_js_1.Visitor(scalarDirection, this.schema, this.config);
    }
    buildTypeDefinitionArguments(node, visitor) {
        return visitor.buildArgumentsSchemaBlock(node, (typeName, field) => {
            this.importTypes.push(typeName);
            return this.buildInputFields(field.arguments ?? [], visitor, typeName);
        });
    }
}
exports.BaseSchemaVisitor = BaseSchemaVisitor;
