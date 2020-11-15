import { Field, InputType } from '@nestjs/graphql'

@InputType()
export class BlockHashFilter {
    @Field(() => [String], { nullable: true })
    blockHashes?: string[]

    @Field({ nullable: true })
    fromHash?: string

    @Field({ nullable: true })
    toHash?: string
}
