import { Module } from '@nestjs/common'
import { RpcResolver } from './rpc.resolver'
import { RpcService } from './rpc.service'
import { BlockScalar } from './models/block.model'
import { TransactionScalar } from './models/transaction.model'
import { RpcController } from './rpc.controller'
import { BlockchainModule } from '~/blockchain/blockchain.module'
import {JSONScalar} from "~/rpc/scalers/json.scalar";

@Module({
    imports: [BlockchainModule.register(process.env.BLOCKCHAIN)],
    providers: [
        RpcResolver,
        RpcService,
        JSONScalar,
        BlockScalar,
        TransactionScalar,
    ],
    controllers: [RpcController],
    exports: [RpcService],
})
export class RpcModule {}
