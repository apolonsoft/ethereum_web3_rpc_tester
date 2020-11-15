import { Scalar } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

export { GraphQLJSON } from 'graphql-type-json';

@Scalar('JSON', () => GraphQLJSON)
export class JSONScalar {}
