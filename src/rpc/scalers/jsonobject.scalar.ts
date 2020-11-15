import { Scalar } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

export { GraphQLJSONObject } from 'graphql-type-json';

@Scalar('JSONObject', () => GraphQLJSONObject)
export class JSONObjectScalar {}
