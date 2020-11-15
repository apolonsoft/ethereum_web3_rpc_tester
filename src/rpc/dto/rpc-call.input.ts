import { Field, InputType, ID } from '@nestjs/graphql'
import { LoggedInput } from './logged.input'
import GraphQLJSON from "graphql-type-json";

@InputType()
export class RPCCallInput extends LoggedInput {
    @Field(() => ID)
    id: string

    @Field()
    method: string

    @Field(() => GraphQLJSON, { nullable: true })
    params?: any
}
