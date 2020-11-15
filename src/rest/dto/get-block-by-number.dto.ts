import { IsInt } from 'class-validator'

import { LoggedDto } from './logged.dto'

export class GetBlockByNumberDto extends LoggedDto {
    @IsInt()
    blockNums: number
}
