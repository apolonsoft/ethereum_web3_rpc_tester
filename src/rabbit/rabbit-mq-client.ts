import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices'
import * as amqp from 'amqplib'
import Redis from 'ioredis'
import { Logger } from '@nestjs/common'

export class RabbitMQClient extends ClientProxy {
    constructor(
        private readonly dbHost: string,
        private readonly walletHost: string,
        private readonly exchange: string,
        private readonly exchangeType: string,
        private readonly queues: string[],
        private readonly durable: boolean,
        private readonly prefetchCount: number,
        private readonly isGlobalPrefetch: boolean,
    ) {
        super()
    }

    private dbServer: amqp.Connection = null
    private dbChannel: amqp.Channel = null
    private walletServer: amqp.Connection = null
    private walletChannel: amqp.Channel = null

    private readonly logger = new Logger(':::RabbitMQClient:::')
    private redisClient = new Redis(JSON.parse(process.env.REDIS)[0])

    async sendToExchange<TResult = any, TInput = any>(
        pattern: any,
        data: TInput,
        blockNumber?: number,
    ): Promise<void> {
        try {
            this.dbChannel &&
                (await this.dbChannel.publish(
                    this.exchange,
                    '',
                    Buffer.from(JSON.stringify({ pattern, data })),
                ))
            this.walletChannel &&
                (await this.walletChannel.publish(
                    'walletXch',
                    '',
                    Buffer.from(JSON.stringify({ pattern, data })),
                ))
        } catch (e) {
            this.logger.error(
                `Cant send to exchange because RabbitMQ disconnected: ${e.message}`,
            )
            if (blockNumber) {
                await this.redisClient.set('blk:' + blockNumber, '')
                console.log('added block to redis from rabbit', blockNumber)
            }
        }
    }

    async connect(): Promise<any> {
        if (
            !(await this.redisClient.set(
                `lock:rmqconnecting`,
                'true',
                'NX',
                'EX',
                600,
            ))
        ) {
            return
        }
        this.close()

        this.logger.debug('Connecting to rabbitMQ...')

        try {
            if (this.dbHost) {
                this.dbServer = await amqp.connect(
                    this.dbHost + '?heartbeat=15',
                )

                this.dbServer.on('error', async () => {
                    this.logger.error('Rabbit dbServer connection error')
                    await this.connect()
                })
                this.dbServer.on('close', async () => {
                    this.logger.error('Rabbit dbServer connection closed')
                    await this.connect()
                })

                this.dbChannel = await this.dbServer.createChannel()

                await this.dbChannel.prefetch(
                    this.prefetchCount,
                    this.isGlobalPrefetch,
                )
                await this.dbChannel.assertExchange(
                    this.exchange,
                    this.exchangeType,
                )

                for (const queue of this.queues) {
                    await this.dbChannel.assertQueue(queue, {
                        durable: this.durable,
                    })
                    await this.dbChannel.bindQueue(queue, this.exchange, '')
                }
            }

            this.walletServer = await amqp.connect(
                this.walletHost + '?heartbeat=15',
            )

            this.walletServer.on('error', async () => {
                this.logger.error('Rabbit walletServer connection error')
                await this.connect()
            })
            this.walletServer.on('close', async () => {
                this.logger.error('Rabbit walletServer connection closed')
                await this.connect()
            })

            this.walletChannel = await this.walletServer.createChannel()

            await this.walletChannel.prefetch(
                this.prefetchCount,
                this.isGlobalPrefetch,
            )
            await this.walletChannel.assertExchange(
                'walletXch',
                this.exchangeType,
            )
            await this.walletChannel.assertQueue('wallet', {
                durable: this.durable,
            })
            await this.walletChannel.bindQueue('wallet', 'walletXch', '')

            // if(+process.env.DUPLICATE_WALLET_QUEUE) {
            //     await this.walletChannel.assertQueue('wallet-test', {
            //         durable: this.durable,
            //     })
            //     await this.walletChannel.bindQueue('wallet-test', 'walletXch', '')
            // }

            await this.redisClient.del(['lock:rmqconnecting'])
            this.logger.debug('Successfully connected to rabbitMQ')
        } catch (e) {
            this.logger.error(
                'RabbitMQ connecting error. Trying again in 5 seconds',
            )
            return setTimeout(async () => {
                await this.redisClient.del(['lock:rmqconnecting'])
                await this.connect()
            }, 5000)
        }
    }

    close(): any {
        this.dbServer?.close().catch(() => {})
        this.walletServer?.close().catch(() => {})
    }

    protected publish(
        packet: ReadPacket<any>,
        callback: (packet: WritePacket<any>) => void,
    ): () => unknown {
        throw new Error('Method not implemented.')
    }

    protected dispatchEvent<T = any>(packet: ReadPacket): Promise<T> {
        throw new Error('Method not implemented.')
        return Promise.resolve(undefined)
    }
}
