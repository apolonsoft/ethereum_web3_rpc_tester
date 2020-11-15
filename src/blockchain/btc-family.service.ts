import {
    Injectable,
    HttpService,
    OnModuleInit,
    OnApplicationBootstrap,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ApolloError } from 'apollo-server'
import { v4 as uuid } from 'uuid'
import { Subject } from 'rxjs'

import { Node } from './interfaces/node.interface'
import { BlockchainService } from './interfaces/blockchain-service.interface'
import { RPCCallInput } from '~/rpc/dto/rpc-call.input'
import { ContractCallInput } from '~/rpc/dto/contract-call.input'
import { GetInfoInput } from '~/rpc/dto/get-info.input'
import { GetBlockByNumberInput } from '~/rpc/dto/get-block-by-number.input'
import { GetBlockByHashInput } from '~/rpc/dto/get-block-by-hash.input'
import { GetBlocksInput } from '~/rpc/dto/get-blocks.input'
import { SendSignedTransactionInput } from '~/rpc/dto/send-signed-transaction.input'
import { Subscriber } from 'zeromq'
import { RabbitMQClient } from '~/rabbit/rabbit-mq-client'
import Redis from 'ioredis'

@Injectable()
export class BtcFamilyService
    implements BlockchainService, OnApplicationBootstrap {
    public nodes: Node[]
    public actualNode: Node
    public actualNodeSubject: Subject<Node>
    private eventQueue: RabbitMQClient
    private redisClient
    private blockChain

    constructor(private httpService: HttpService) {
        this.blockChain = process.env.BLOCKCHAIN
        this.actualNodeSubject = new Subject()
        this.nodes = (JSON.parse(process.env.NODES) as string[][]).map(
            (chunk) => {
                const [host, port, zmqHost, zmqPort, username, password] = chunk
                return {
                    host,
                    port,
                    zmqHost,
                    zmqPort,
                    username,
                    password,
                }
            },
        )
    }

    async onApplicationBootstrap() {
        this.redisClient = new Redis(JSON.parse(process.env.REDIS)[0])
        await this.redisClient.del(['lock:rmqconnecting'])
        await this.selectActualNode()
        if (process.env.RMQ_WALLET_URLS) {
            this.eventQueue = new RabbitMQClient(
                null,
                JSON.parse(process.env.RMQ_WALLET_URLS)[0],
                'rpc',
                'fanout',
                [],
                true,
                1,
                true,
            )
            await this.eventQueue.connect()
        }
    }

    private checkGetBlockParams(blockHash, verbosity) {
        switch (this.blockChain) {
            case 'DOGECOIN':
            case 'EMERCOIN':
            case 'DASHCOIN':
                return [blockHash]
            default:
                return [blockHash, verbosity ?? 2]
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    public async checkNullTxHashes() {
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

    @Cron(CronExpression.EVERY_5_MINUTES)
    public async selectActualNode() {
        let lastBlockCount = 0
        let lastActualNode: Node
        for (const node of this.nodes) {
            try {
                const request = await this.request({
                    method: 'getblockchaininfo',
                    node: node,
                })
                const { blocks, warnings, initialblockdownload } = request

                if (!lastActualNode) {
                    lastActualNode = node
                }
                if (initialblockdownload) {
                    continue
                }
                if (warnings?.includes('agree')) {
                    continue
                }
                if (blocks >= lastBlockCount) {
                    lastBlockCount = blocks
                    lastActualNode = node
                }
            } catch (e) {
                console.log(e)
                continue
            }
        }
        if (lastActualNode) {
            this.actualNode = lastActualNode
            this.actualNodeSubject.next(this.actualNode)
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
        node?: Node
    }) {
        const nodeToUse = node || this.actualNode
        if (!nodeToUse) {
            throw new Error('No nodes available')
        }

        try {
            const request = await this.httpService
                .post(
                    `http://${nodeToUse.username}:${nodeToUse.password}@${nodeToUse.host}:${nodeToUse.port}`,
                    {
                        jsonrpc: '1.0',
                        id: id || uuid(),
                        method: method.toLowerCase(),
                        params: params || [],
                    },
                )
                .toPromise()
            return request.data.result
        } catch (e) {
            console.log(e.message)
            if (e.response?.data?.error) {
                const {
                    response: {
                        data: {
                            error: { message, code },
                            id,
                        },
                    },
                } = e
                throw new ApolloError(message, code, { id })
            } else {
                //throw e
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
        const blockCount = await this.call('getblockcount')
        const peerCount = (await this.call('getpeerinfo')).length
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
        const blockHash = await this.call('getbestblockhash')
        return this.call('getblock', this.checkGetBlockParams(blockHash, 2))
    }

    async getBlockByNumber(input: GetBlockByNumberInput) {
        const blockHash = await this.call('getblockhash', [input.blockNums])
        return this.call(
            'getblock',
            this.checkGetBlockParams(blockHash, input.verbosity),
        )
    }

    async getBlockByHash(input: GetBlockByHashInput) {
        return this.call(
            'getblock',
            this.checkGetBlockParams(input.blockHash, input.verbosity),
        )
    }

    async getBlocks(input: GetBlocksInput) {
        const result = []
        const { filter, verbosity } = input

        if (filter.hashFilter) {
            const { blockHashes, fromHash, toHash } = filter.hashFilter
            if (blockHashes) {
                for (const hash of blockHashes) {
                    result.push(
                        await this.call(
                            'getblock',
                            this.checkGetBlockParams(hash, verbosity),
                        ),
                    )
                }
            }
            if (fromHash && toHash) {
                const blocks = []
                let currentBlock = await this.call(
                    'getblock',
                    this.checkGetBlockParams(fromHash, verbosity),
                )
                blocks.push(currentBlock)
                while (currentBlock.hash !== toHash) {
                    currentBlock = await this.call(
                        'getblock',
                        this.checkGetBlockParams(
                            currentBlock.nextblockhashm,
                            verbosity,
                        ),
                    )
                    blocks.push(currentBlock)
                }
                result.push(...blocks)
            }
        } else if (filter.numFilter) {
            const { blockNums, fromNum, toNum } = filter.numFilter
            if (blockNums) {
                for (const num of blockNums) {
                    const hash = await this.call('getblockhash', [num])
                    result.push(
                        await this.call(
                            'getblock',
                            this.checkGetBlockParams(hash, verbosity),
                        ),
                    )
                }
            }
            if (fromNum && toNum) {
                const blocks = []
                const initialHash = await this.call('getblockhash', [fromNum])
                let currentBlock = await this.call(
                    'getblock',
                    this.checkGetBlockParams(initialHash, verbosity),
                )
                blocks.push(currentBlock)
                while (currentBlock.height < toNum) {
                    currentBlock = await this.call(
                        'getblock',
                        this.checkGetBlockParams(
                            currentBlock.nextblockhash,
                            verbosity,
                        ),
                    )

                    blocks.push(currentBlock)
                }
                result.push(...blocks)
            }
        }
        return result
    }

    async getTxsByHash(txIds: string[]) {
        const result = []
        for (const txId of txIds) {
            result.push(await this.call('getrawtransaction', [txId, true]))
        }
        return result
    }

    async sendSignedTransaction(input: SendSignedTransactionInput) {
        return this.call('sendrawtransaction', [input.hex])
    }

    async runNodeListener(node: Node) {
        if (!this.eventQueue) {
            return
        }
        let socket: Subscriber
        try {
            if (socket) {
                socket.close()
            }
            socket = new Subscriber()
            socket.connect(`tcp://${node.zmqHost}:${node.zmqPort}`)
            socket.subscribe()

            for await (const [topic, message] of socket) {
                switch (topic.toString()) {
                    case 'hashtx':
                        const txHash = message.toString('hex')
                        if (
                            await this.redisClient.set(
                                `lock:tx:${txHash}`,
                                '',
                                'NX',
                                'EX',
                                90,
                            )
                        ) {
                            this.getTxsByHash([txHash]).then((rawTx) => {
                                if (!rawTx[0]) {
                                    this.redisClient.set(
                                        `nulltx:${txHash}`,
                                        '',
                                        'EX',
                                        900,
                                    )
                                    return
                                }
                                console.log('incoming tx: ', txHash)
                                this.eventQueue.sendToExchange('tx', {
                                    blockchain: process.env.BLOCKCHAIN,
                                    data: rawTx[0],
                                })
                            })
                        }
                        break
                    case 'hashblock':
                        const blockHash = message.toString('hex')
                        if (
                            await this.redisClient.set(
                                `lock:block:${blockHash}`,
                                '',
                                'NX',
                                'EX',
                                300,
                            )
                        ) {
                            this.getBlockByHash({
                                uuid: uuid(),
                                blockHash,
                            }).then((rawBlock) => {
                                console.log('incoming block: ', rawBlock.height)
                                this.eventQueue.sendToExchange('block', {
                                    blockchain: process.env.BLOCKCHAIN,
                                    data: rawBlock,
                                })
                            })
                        }
                        break
                }
            }
        } catch (e) {
            console.log(e)
            socket.close()
            this.selectActualNode()
        }
    }

    onModuleDestroy() {
        this.eventQueue && this.eventQueue.close()
    }
}
