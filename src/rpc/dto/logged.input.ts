import { InputType, Field } from '@nestjs/graphql'
import { IsUUID } from 'class-validator'

@InputType()
export class LoggedInput {
    @Field()
    @IsUUID()
    uuid: string
}
