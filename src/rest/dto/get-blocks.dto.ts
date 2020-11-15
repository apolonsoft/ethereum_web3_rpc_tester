import { ValidateNested, IsArray, IsAscii, IsInt } from 'class-validator'
import { Type } from 'class-transformer'

import { LoggedDto } from './logged.dto'

export class BlockHashFilter {
    @IsArray()
    blockHashes?: string[]

    @IsAscii()
    fromHash?: string

    @IsAscii()
    toHash?: string
}

export class BlockNumFilter {
    @IsArray()
    blockNums?: number[]

    @IsInt()
    fromNum?: number

    @IsInt()
    toNum?: number
}

export class BlocksFilter {
    hashFilter?: BlockHashFilter

    numFilter?: BlockNumFilter
}

export class GetBlocksDto extends LoggedDto {
    @ValidateNested({ each: true })
    @Type(() => BlocksFilter)
    filter: BlocksFilter
}
