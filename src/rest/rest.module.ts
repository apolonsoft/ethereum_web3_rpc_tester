import { Module } from '@nestjs/common'

import { RpcModule } from '~/rpc/rpc.module'
import { RestController } from './rest.controller'

@Module({
    imports: [RpcModule],
    controllers: [RestController],
})
export class RestModule {}
