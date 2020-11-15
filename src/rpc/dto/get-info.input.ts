import { InputType } from '@nestjs/graphql'

import { LoggedInput } from './logged.input'

@InputType()
export class GetInfoInput extends LoggedInput {}
