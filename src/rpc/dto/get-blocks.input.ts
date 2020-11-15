import { Field, InputType, Int } from '@nestjs/graphql'

import { LoggedInput } from './logged.input'
import { BlocksFilter } from './blocks-filter.input'

@InputType()
export class GetBlocksInput extends LoggedInput {
    @Field()
    filter: BlocksFilter

    @Field(() => Int, { nullable: true })
    verbosity?: number
}
