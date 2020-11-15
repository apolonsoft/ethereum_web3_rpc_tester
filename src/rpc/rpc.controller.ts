import { Controller, Inject, OnModuleInit } from '@nestjs/common'
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices'
import { RpcService } from './rpc.service'
import { SendSignedTransactionInput } from './dto/send-signed-transaction.input'
import {Blockchain} from "~/rpc/enums/blockchain.enum";

@Controller()
export class RpcController implements OnModuleInit {
    constructor(
        private rpcService: RpcService,
        @Inject('BlockchainService') private blockchainService,
    ) {}

    onModuleInit() {
        this.blockchainService.actualNodeSubject &&
            this.blockchainService.actualNodeSubject.subscribe(
                async (node) => {
                    await this.blockchainService.runNodeListener(node)
                },
                (err) => {
                    throw err
                },
            )
    }

    @EventPattern('sendSignedTransaction')
    async handleSendSignedTransaction(
        @Payload() data: SendSignedTransactionInput,
        @Ctx() context: RmqContext,
    ) {
        if (data.blockchain === Blockchain[process.env.BLOCKCHAIN]) {
            const channel = context.getChannelRef()
            const originalMsg = context.getMessage()
            try {
                const result = await this.rpcService.sendSignedTransaction(data)
                channel.ack(originalMsg)
                return result
            } catch (e) {
                if (e.extensions) {
                    channel.ack(originalMsg)
                    return {
                        message: e.message,
                        extensions: e.extensions,
                    }
                }
                throw e
            }
        }
    }
}
