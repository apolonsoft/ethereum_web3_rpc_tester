import { Field, InputType, Int } from '@nestjs/graphql'

@InputType()
export class BlockNumFilter {
    @Field(() => [Int], { nullable: true })
    blockNums?: number[]

    @Field(() => Int, { nullable: true })
    fromNum?: number

    @Field(() => Int, { nullable: true })
    toNum?: number
}
