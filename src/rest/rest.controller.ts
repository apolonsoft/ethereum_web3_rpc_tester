import { Controller, Post, Body, Res } from '@nestjs/common'
import { Response } from 'express'
import JsonStreamStringify from 'json-stream-stringify'

import { RpcService } from '~/rpc/rpc.service'
import { GetBlockByNumberDto } from './dto/get-block-by-number.dto'
import { GetBlockByHashDto } from './dto/get-block-by-hash.dto'
import { GetBlocksDto } from './dto/get-blocks.dto'

@Controller('api')
export class RestController {
    constructor(private readonly service: RpcService) {}

    @Post('/getBlockByNumber')
    public async getBlockByNumber(
        @Body() body: GetBlockByNumberDto,
    ): Promise<any> {
        return this.service.getBlockByNumber(body)
    }

    @Post('/getBlockByHash')
    public async getBlockByHash(@Body() body: GetBlockByHashDto): Promise<any> {
        return this.service.getBlockByHash(body)
    }

    @Post('/getBlocks')
    public async getBlocks(
        @Body() body: GetBlocksDto,
        @Res() response: Response,
    ): Promise<any> {
        console.log('getBlocks', body)
        console.time('getBlocks')
        const blocks = await this.service.getBlocks(body)
        console.timeEnd('getBlocks')
        new JsonStreamStringify(blocks).pipe(response)
    }
}
