import { Node } from '~/blockchain/interfaces/node.interface'
import { EthereumNode } from '~/blockchain/interfaces/ethereum-node.interface'
import { Subject } from 'rxjs'
import { RPCCallInput } from '~/rpc/dto/rpc-call.input'
import { ContractCallInput } from '~/rpc/dto/contract-call.input'
import { GetInfoInput } from '~/rpc/dto/get-info.input'
import { GetBlockByNumberInput } from '~/rpc/dto/get-block-by-number.input'
import { GetBlockByHashInput } from '~/rpc/dto/get-block-by-hash.input'
import { GetBlocksInput } from '~/rpc/dto/get-blocks.input'
import { SendSignedTransactionInput } from '~/rpc/dto/send-signed-transaction.input'

export interface BlockchainService {
    nodes: Node[] | EthereumNode[]
    actualNode: Node | EthereumNode
    actualNodeSubject: Subject<Node | EthereumNode>
    selectActualNode()
    request({
        id,
        method,
        params,
        node,
    }: {
        id?: string
        method: string
        params?: any
        node?: Node | EthereumNode
    })
    call(method: string, params?: any)
    getInfo()
    rpcCall(input: RPCCallInput)
    contractCall(input: ContractCallInput)
    getCurrentBlock(input: GetInfoInput)
    getBlockByNumber(input: GetBlockByNumberInput)
    getBlockByHash(input: GetBlockByHashInput)
    getBlocks(input: GetBlocksInput)
    getTxsByHash(txIds: string[])
    sendSignedTransaction(input: SendSignedTransactionInput)
    runNodeListener(node?: Node | EthereumNode)
}
