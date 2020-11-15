import { Field, InputType } from '@nestjs/graphql'

import { BlockHashFilter } from './block-hash-filter.input'
import { BlockNumFilter } from './block-num-filter.input'

@InputType()
export class BlocksFilter {
    @Field(() => BlockHashFilter, { nullable: true })
    hashFilter?: BlockHashFilter

    @Field(() => BlockNumFilter, { nullable: true })
    numFilter?: BlockNumFilter
}
