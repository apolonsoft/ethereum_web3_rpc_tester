import { Field, InputType } from '@nestjs/graphql'

import { LoggedInput } from './logged.input'

@InputType()
export class BlockchainInput extends LoggedInput {
    @Field()
    blockchain: string
}
