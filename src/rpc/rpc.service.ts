import { Inject, Injectable } from '@nestjs/common'
import { RPCCallInput } from './dto/rpc-call.input'
import { ContractCallInput } from './dto/contract-call.input'
import { GetInfoInput } from './dto/get-info.input'
import { GetBlockByNumberInput } from './dto/get-block-by-number.input'
import { GetBlockByHashInput } from './dto/get-block-by-hash.input'
import { GetBlocksInput } from './dto/get-blocks.input'
import { SendSignedTransactionInput } from './dto/send-signed-transaction.input'
import { GetHistoryByAddressesInput } from '~/rpc/dto/get-history-by-addresses.input'
import { Transaction } from '~/rpc/models/transaction.model'

@Injectable()
export class RpcService {
    constructor(@Inject('BlockchainService') private blockchainService) {}

    async getInfo() {
        return this.blockchainService.getInfo()
    }

    async rpcCall(input: RPCCallInput) {
        return this.blockchainService.rpcCall(input)
    }

    async contractCall(input: ContractCallInput) {
        return this.blockchainService.contractCall(input)
    }

    async getCurrentBlock(input: GetInfoInput) {
        return this.blockchainService.getCurrentBlock(input)
    }

    async getBlockByNumber(input: GetBlockByNumberInput) {
        return this.blockchainService.getBlockByNumber(input)
    }

    async getBlockByHash(input: GetBlockByHashInput) {
        return this.blockchainService.getBlockByHash(input)
    }

    async getBlocks(input: GetBlocksInput) {
        return this.blockchainService.getBlocks(input)
    }

    async getTxsByHash(txIds: string[]) {
        return this.blockchainService.getTxsByHash(txIds)
    }

    async sendSignedTransaction(input: SendSignedTransactionInput) {
        return this.blockchainService.sendSignedTransaction(input)
    }

    public async getHistoryByAddresses(
        input: GetHistoryByAddressesInput,
    ): Promise<Transaction> {
        return this.blockchainService.getHistoryByAddresses(input)
    }
}
