import { Field, InputType, Int } from '@nestjs/graphql'

import { LoggedInput } from './logged.input'

@InputType()
export class GetBlockByHashInput extends LoggedInput {
    @Field()
    blockHash: string

    @Field(() => Int, { nullable: true })
    verbosity?: number
}
