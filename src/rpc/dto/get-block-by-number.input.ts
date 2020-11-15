import { Field, InputType, Int } from '@nestjs/graphql'

import { LoggedInput } from './logged.input'

@InputType()
export class GetBlockByNumberInput extends LoggedInput {
    @Field(() => Int)
    blockNums: number

    @Field(() => Int, { nullable: true })
    verbosity?: number
}
