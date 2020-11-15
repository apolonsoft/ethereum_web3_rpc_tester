import { IsAscii } from 'class-validator'

import { LoggedDto } from './logged.dto'

export class GetBlockByHashDto extends LoggedDto {
    @IsAscii()
    blockHash: string
}
