import { Resolver, Mutation, Args, Query } from '@nestjs/graphql'
import { Block } from './models/block.model'
import { RPCCallInput } from './dto/rpc-call.input'
import { ContractCallInput } from './dto/contract-call.input'
import { SendSignedTransactionInput } from './dto/send-signed-transaction.input'
import { GetBlockByNumberInput } from './dto/get-block-by-number.input'
import { GetBlockByHashInput } from './dto/get-block-by-hash.input'
import { GetBlocksInput } from './dto/get-blocks.input'
import { Transaction } from './models/transaction.model'
import { GetInfoInput } from './dto/get-info.input'
import { RpcService } from './rpc.service'
import { GetHistoryByAddressesInput } from '~/rpc/dto/get-history-by-addresses.input'
import GraphQLJSON from "graphql-type-json";

@Resolver('Rpc')
export class RpcResolver {
    constructor(private readonly service: RpcService) {}

    @Query(() => GraphQLJSON)
    async getInfo(@Args('input') input: GetInfoInput) {
        return this.service.getInfo()
    }

    @Query(() => GraphQLJSON, { nullable: true })
    async rpcCall(@Args('input') input: RPCCallInput) {
        return this.service.rpcCall(input)
    }

    @Query(() => GraphQLJSON, { nullable: true })
    async contractCall(@Args('input') input: ContractCallInput) {
        return this.service.contractCall(input)
    }

    @Query(() => Block)
    async getCurrentBlock(@Args('input') input: GetInfoInput): Promise<Block> {
        return this.service.getCurrentBlock(input)
    }

    @Query(() => Block)
    async getBlockByNumber(
        @Args('input') input: GetBlockByNumberInput,
    ): Promise<Block> {
        return this.service.getBlockByNumber(input)
    }

    @Query(() => Block)
    async getBlockByHash(
        @Args('input') input: GetBlockByHashInput,
    ): Promise<Block> {
        return this.service.getBlockByHash(input)
    }

    @Query(() => [Block])
    async getBlocks(@Args('input') input: GetBlocksInput): Promise<Block[]> {
        return this.service.getBlocks(input)
    }

    @Query(() => [Transaction])
    async getTxsByHash(
        @Args('txId', { type: () => [String] }) txIds: string[],
    ): Promise<Transaction[]> {
        return this.service.getTxsByHash(txIds)
    }

    @Mutation(() => String)
    async sendSignedTransaction(
        @Args('input') input: SendSignedTransactionInput,
    ): Promise<string> {
        return this.service.sendSignedTransaction(input)
    }

    @Query(() => GraphQLJSON)
    async getHistoryByAddresses(
        @Args('input') input: GetHistoryByAddressesInput,
    ): Promise<any> {
        return this.service.getHistoryByAddresses(input)
    }
}
