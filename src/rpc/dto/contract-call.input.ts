import { Field, InputType } from '@nestjs/graphql'
import { LoggedInput } from './logged.input'
import GraphQLJSON from "graphql-type-json";

@InputType()
export class ContractCallInput extends LoggedInput {
    @Field()
    contractName: string

    @Field()
    method: string

    @Field(() => GraphQLJSON, { nullable: true })
    params?: Record<string, unknown>
}
