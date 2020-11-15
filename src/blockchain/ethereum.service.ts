import {
    Injectable,
    HttpService,
    OnApplicationBootstrap,
    Logger,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { v4 as uuid } from 'uuid'
import { Subject } from 'rxjs'
import { EthereumNode } from './interfaces/ethereum-node.interface'
import { BlockchainService } from './interfaces/blockchain-service.interface'
import Redis from 'ioredis'
import Web3 from 'web3'
import { RPCCallInput } from '~/rpc/dto/rpc-call.input'
import { ContractCallInput } from '~/rpc/dto/contract-call.input'
import { GetInfoInput } from '~/rpc/dto/get-info.input'
import { GetBlockByNumberInput } from '~/rpc/dto/get-block-by-number.input'
import { GetBlockByHashInput } from '~/rpc/dto/get-block-by-hash.input'
import { GetBlocksInput } from '~/rpc/dto/get-blocks.input'
import { SendSignedTransactionInput } from '~/rpc/dto/send-signed-transaction.input'
import { RabbitMQClient } from '~/rabbit/rabbit-mq-client'

@Injectable()
export class EthereumService
    implements BlockchainService, OnApplicationBootstrap {
    public nodes: EthereumNode[]
    public actualNode: EthereumNode
    public actualNodeSubject: Subject<EthereumNode>
    private redisClient
    private web3: Web3
    private txSubscription
    private blockSubscription
    private subscriptionCurrentNode: EthereumNode
    private eventQueue: RabbitMQClient
    private readonly logger = new Logger(`:::${EthereumService.name}:::`)

    constructor(private httpService: HttpService) {
        this.actualNodeSubject = new Subject()
        this.nodes = (JSON.parse(process.env.NODES) as string[][]).map(
            (chunk) => {
                const [host, rpcPort, wsPort] = chunk
                return {
                    host,
                    rpcPort,
                    wsPort,
                }
            },
        )
    }

    async onApplicationBootstrap() {
        this.redisClient = new Redis(JSON.parse(process.env.REDIS)[0])
        await this.redisClient.del(['lock:rmqconnecting'])
        if (process.env.RMQ_DB_URLS && process.env.RMQ_WALLET_URLS) {
            this.eventQueue = new RabbitMQClient(
                JSON.parse(process.env.RMQ_DB_URLS)[0],
                JSON.parse(process.env.RMQ_WALLET_URLS)[0],
                'rpc',
                'fanout',
                ['db'],
                true,
                1,
                true,
            )
            await this.eventQueue.connect()
        }
        await this.selectActualNode()

        //this.emitter.on('rmqConnected', async () => {})
    }

    @Cron('*/90 * * * * *')
    public async checkNullTxHashes() {
        this.logger.debug('Start checking txs...')

        if (!(await this.isServicesOnline())) {
            this.logger.error('Stop checking txs because services offline')
            return
        }
        const txIds = (await this.redisClient.keys('nulltx:*')).map((txId) =>
            txId.slice(7),
        )
        const fetchedTxs = (await this.getTxsByHash(txIds)).filter((tx) => tx)
        if (!fetchedTxs.length) {
            return
        }
        const keysToDelete = fetchedTxs.map((tx) => 'nulltx:' + tx.hash)
        await this.redisClient.del(keysToDelete)
        if (!this.eventQueue) {
            return
        }
        for (const tx of fetchedTxs) {
            await this.eventQueue.sendToExchange('tx', {
                blockchain: process.env.BLOCKCHAIN,
                data: tx,
            })
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    public async processMissedBlocks() {
        this.logger.debug('Start checking blocks...')

        if (!(await this.isServicesOnline())) {
            this.logger.error('Stop checking blocks because services offline')
            return
        }

        const blockNumbers = (await this.redisClient.keys('blk:*')).map((key) =>
            key.slice(4),
        )

        console.log('blocks in Redis now:', blockNumbers)

        if (!blockNumbers?.length) {
            return
        }

        let fetchedBlocks = []

        for (const number of blockNumbers) {
            fetchedBlocks.push(
                await this.getBlockByNumber({
                    uuid: uuid(),
                    blockNums: +number,
                }),
            )
        }

        fetchedBlocks = fetchedBlocks.filter((block) => block)
        if (!fetchedBlocks.length) {
            return
        }
        const keysToDelete = fetchedBlocks.map(
            (block) => 'blk:' + parseInt(block.number, 16),
        )
        await this.redisClient.del(keysToDelete)

        console.log(
            'block in Redis after delete fetched:',
            (await this.redisClient.keys('blk:*')).map((key) => key.slice(4)),
        )

        for (const block of fetchedBlocks) {
            await this.eventQueue.sendToExchange(
                'block',
                {
                    blockchain: process.env.BLOCKCHAIN,
                    data: block,
                },
                parseInt(block.number, 16),
            )
        }
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    public async selectActualNode() {
        let lastBlockCount = 0
        let lastActualNode: EthereumNode = null
        for (const node of this.nodes) {
            try {
                const lastBlock = await this.request({
                    method: 'eth_blockNumber',
                    node: node,
                })
                if (lastBlock >= lastBlockCount) {
                    lastBlockCount = lastBlock
                    lastActualNode = node
                }
            } catch (e) {
                this.logger.error(
                    'selectActualNode error while getting eth_blockNumber',
                    e.message,
                )
                continue
            }
        }
        this.actualNode = lastActualNode
        this.logger.debug(
            `Actual node now is: ${this.actualNode?.host || null}`,
        )
        this.actualNodeSubject.next(this.actualNode)
    }

    private async isServicesOnline(): Promise<boolean> {
        if (await this.redisClient.get('lock:rmqconnecting')) {
            return false
        }
        try {
            return await this.web3.eth.net.isListening()
        } catch (e) {
            return false
        }

        // try {
        //     return !!(await this.request({
        //         method: 'eth_blockNumber',
        //         node: this.actualNode,
        //     }))
        // } catch (e) {
        //     return false
        // }
    }

    async runNodeListener(node: EthereumNode) {
        if (
            node &&
            this.subscriptionCurrentNode &&
            this.subscriptionCurrentNode.host === node.host &&
            this.subscriptionCurrentNode.wsPort === node.wsPort
        ) {
            this.logger.debug('Keep subscriptions because same node')
            return
        }

        this.stopNodeSubscription()

        if (!this.actualNode) {
            this.logger.debug('Stop subscriptions because no actual node')
            return
        }

        this.subscriptionCurrentNode = node

        try {
            const provider =
                node.host === 'infura'
                    ? node.wsPort
                    : `ws://${node.host}:${node.wsPort}`
            this.web3 = new Web3(provider)

            this.logger.debug('Start new subscriptions')

            if (+process.env.CHECK_MISSED_BLOCKS) {
                await this.checkMissedBlocks(node)
            }

            this.blockSubscription = this.web3.eth.subscribe(
                'newBlockHeaders',
                async (error, block) => {
                    if (error) {
                        this.logger.error('Blocks subscription interrupted')
                        this.stopNodeSubscription()
                        return
                    }
                    if ( +process.env.DISABLE_DUPLICATE_BLOCKS_LOCK ||
                        await this.redisClient.set(
                            `lock:block:${block.hash}`,
                            '',
                            'NX',
                            'EX',
                            300,
                        )
                    ) {
                        let newBlock = await this.getBlockByNumber({
                            uuid: uuid(),
                            blockNums: +block.number,
                            verbosity: 2,
                        })
                        if (!newBlock) {
                            newBlock = await this.getBlockByHash({
                                uuid: uuid(),
                                blockHash: block.hash,
                                verbosity: 2,
                            })
                        }

                        if (!newBlock) {
                            this.redisClient.set(
                                `nullblock:${block.number}`,
                                '',
                                'EX',
                                900,
                            )
                            console.log(`added block to redis ${block.number}`)
                            return
                        }
                        console.log('New block: ', block.number)

                        if (this.eventQueue && newBlock) {
                            await this.eventQueue.sendToExchange(
                                'block',
                                {
                                    blockchain: process.env.BLOCKCHAIN,
                                    data: newBlock,
                                },
                                parseInt(newBlock.number, 16),
                            )
                            this.redisClient.set(
                                `lastSentBlockNumber`,
                                block.number,
                            )
                        }
                    }
                },
            )

            this.txSubscription = this.web3.eth.subscribe(
                'pendingTransactions',
                async (error, txHash) => {
                    if (error) {
                        this.logger.error(
                            'Transactions subscription interrupted',
                        )
                        this.stopNodeSubscription()
                        return
                    }

                    if (+process.env.DISABLE_DUPLICATE_TXS_LOCK ||
                        await this.redisClient.set(
                            `lock:tx:${txHash}`,
                            '',
                            'NX',
                            'EX',
                            90,
                        )
                    ) {
                        this.getTxsByHash([txHash]).then((tx) => {
                            if (!tx[0]) {
                                this.redisClient.set(
                                    `nulltx:${txHash}`,
                                    '',
                                    'EX',
                                    900,
                                )
                                return
                            }
                            //console.log('New tx: ', tx[0].hash)
                            if (this.eventQueue) {
                                this.eventQueue.sendToExchange('tx', {
                                    blockchain: process.env.BLOCKCHAIN,
                                    data: tx[0],
                                })
                            }
                        })
                    }
                },
            )
        } catch (e) {
            console.log('Error while subscribing', e.message)
            this.stopNodeSubscription()
        }
    }

    private async checkMissedBlocks(node: EthereumNode) {
        const lastSentBlockNumber = +(await this.redisClient.get(
            'lastSentBlockNumber',
        ))

        const currentBlock = parseInt(
            await this.request({
                method: 'eth_blockNumber',
                node: node,
            }),
            16,
        )

        console.log(
            'lastSentBlockNumber',
            lastSentBlockNumber,
            'currentBlock',
            currentBlock,
        )

        if (lastSentBlockNumber !== currentBlock) {
            for (let i = lastSentBlockNumber + 1; i <= currentBlock; i++) {
                console.log('added block to redis', i)
                await this.redisClient.set('blk:' + i, i)
            }
        }
    }

    private stopNodeSubscription() {
        if (this.subscriptionCurrentNode) {
            this.web3 = null
            this.blockSubscription.unsubscribe()
            this.txSubscription.unsubscribe()
            this.subscriptionCurrentNode = null
        }
    }

    async request({
        id,
        method,
        params,
        node,
    }: {
        id?: string
        method: string
        params?: any
        node?: EthereumNode
    }) {
        const nodeToUse = node || this.actualNode

        if (!nodeToUse) {
            this.logger.error(`No nodes available for request method ${method}`)
            return
        }

        try {
            const provider =
                nodeToUse.host === 'infura'
                    ? nodeToUse.rpcPort
                    : `http://${nodeToUse.host}:${nodeToUse.rpcPort}`
            const request = await this.httpService
                .post(provider, {
                    jsonrpc: '2.0',
                    id: id || uuid(),
                    method: method,
                    params: params || [],
                })
                .toPromise()
            return request.data.result
        } catch (e) {
            if (e.response) {
                this.logger.error(
                    `Request method ${method} call errored with some response: `,
                )
                console.log(e.response)
            } else {
                this.logger.error(
                    `Request method ${method} call errored with no response`,
                )
            }
        }
    }

    async call(method: string, params?: any) {
        return this.request({
            method,
            params,
        })
    }

    async getInfo() {
        const blockCount = await this.call('eth_blockNumber')
        const peerCount = (await this.call('net_peerCount')).length
        return {
            blockCount,
            peerCount,
        }
    }

    async rpcCall(input: RPCCallInput) {
        return this.request({
            id: input.id,
            method: input.method,
            params: input.params,
        })
    }

    async contractCall(input: ContractCallInput) {
        return this.request({
            id: input.contractName,
            method: input.method,
            params: input.params,
        })
    }

    async getCurrentBlock(input: GetInfoInput) {
        const blockNumber = await this.call('eth_blockNumber')
        return this.call('eth_getBlockByNumber', [blockNumber, true])
    }

    async getBlockByNumber(input: GetBlockByNumberInput) {
        return this.call('eth_getBlockByNumber', [
            `0x${input.blockNums.toString(16)}`,
            input.verbosity !== null ? input.verbosity > 0 : true,
        ])
    }

    async getBlockByHash(input: GetBlockByHashInput) {
        return this.call('eth_getBlockByHash', [
            input.blockHash,
            input.verbosity !== null ? input.verbosity > 0 : true,
        ])
    }

    async getBlocks(input: GetBlocksInput) {
        const result = []
        const { filter, verbosity } = input

        if (filter.hashFilter) {
            const { blockHashes, fromHash, toHash } = filter.hashFilter
            if (blockHashes) {
                for (const hash of blockHashes) {
                    result.push(
                        await this.call('eth_getBlockByHash', [
                            hash,
                            verbosity !== null ? verbosity > 0 : true,
                        ]),
                    )
                }
            }
            if (fromHash && toHash) {
                const blocks = []
                let currentBlock = await this.call('eth_getBlockByHash', [
                    toHash,
                    verbosity !== null ? verbosity > 0 : true,
                ])
                blocks.push(currentBlock)
                while (currentBlock.hash !== fromHash) {
                    currentBlock = await this.call('eth_getBlockByHash', [
                        currentBlock.parentHash,
                        verbosity !== null ? verbosity > 0 : true,
                    ])
                    blocks.unshift(currentBlock)
                }
                result.push(...blocks)
            }
        } else if (filter.numFilter) {
            const { blockNums, fromNum, toNum } = filter.numFilter
            if (blockNums) {
                for (const num of blockNums) {
                    result.push(
                        await this.call('eth_getBlockByNumber', [
                            `0x${num.toString(16)}`,
                            verbosity !== null ? verbosity > 0 : true,
                        ]),
                    )
                }
            }
            if (fromNum && toNum) {
                const blocks = []
                let currentBlock = await this.call('eth_getBlockByNumber', [
                    `0x${toNum.toString(16)}`,
                    verbosity !== null ? verbosity > 0 : true,
                ])
                blocks.push(currentBlock)
                while (currentBlock.number > fromNum) {
                    currentBlock = await this.call('eth_getBlockByHash', [
                        currentBlock.parentHash,
                        verbosity !== null ? verbosity > 0 : true,
                    ])
                    blocks.unshift(currentBlock)
                }
                result.push(...blocks)
            }
        }
        return result
    }

    async getTxsByHash(txIds: string[]) {
        const result = []
        for (const txId of txIds) {
            result.push(await this.call('eth_getTransactionByHash', [txId]))
        }
        return result
    }

    async sendSignedTransaction(input: SendSignedTransactionInput) {
        return this.call('eth_sendRawTransaction', [input.hex])
    }

    onModuleDestroy() {
        this.txSubscription.unsubscribe
        this.blockSubscription.unsubscribe
        this.eventQueue && this.eventQueue.close()
    }
}
