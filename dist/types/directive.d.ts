import type { ConstArgumentNode, ConstDirectiveNode, ConstValueNode } from 'graphql';
import type { DirectiveConfig, DirectiveObjectArguments } from './config.js';
export interface FormattedDirectiveConfig {
    [directive: string]: FormattedDirectiveArguments;
}
export interface FormattedDirectiveArguments {
    [argument: string]: string[] | FormattedDirectiveObjectArguments | undefined;
}
export interface FormattedDirectiveObjectArguments {
    [matched: string]: string[] | undefined;
}
export declare function formatDirectiveConfig(config: DirectiveConfig): FormattedDirectiveConfig;
export declare function formatDirectiveObjectArguments(args: DirectiveObjectArguments): FormattedDirectiveObjectArguments;
export declare function buildApi(config: FormattedDirectiveConfig, directives: ReadonlyArray<ConstDirectiveNode>): string;
export declare function buildApiForValibot(config: FormattedDirectiveConfig, directives: ReadonlyArray<ConstDirectiveNode>): string[];
declare function buildApiFromDirectiveArguments(config: FormattedDirectiveArguments, args: ReadonlyArray<ConstArgumentNode>): string;
declare function buildApiFromDirectiveObjectArguments(config: FormattedDirectiveObjectArguments, argValue: ConstValueNode): string;
declare function applyArgToApiSchemaTemplate(template: string, apiArgs: any[]): string;
export declare const exportedForTesting: {
    applyArgToApiSchemaTemplate: typeof applyArgToApiSchemaTemplate;
    buildApiFromDirectiveObjectArguments: typeof buildApiFromDirectiveObjectArguments;
    buildApiFromDirectiveArguments: typeof buildApiFromDirectiveArguments;
};
export {};
