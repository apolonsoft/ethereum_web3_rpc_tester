import {
    Module,
    HttpModule,
    DynamicModule,
    NotFoundException,
} from '@nestjs/common'
import { BlockchainService } from '~/blockchain/interfaces/blockchain-service.interface'
import { EthereumService } from '~/blockchain/ethereum.service'
import { BtcFamilyService } from '~/blockchain/btc-family.service'

@Module({})
export class BlockchainModule {
    static register(blockchain: string): DynamicModule {
        let blockchainService
        switch (blockchain) {
            case 'ETHEREUM':
                blockchainService = EthereumService
                break
            default:
                throw new NotFoundException(
                    `BLOCKCHAIN parameter ${process.env.BLOCKCHAIN} from .env not supplied!`,
                )
        }

        const blockchainServiceProvider = {
            provide: 'BlockchainService',
            useClass: blockchainService,
        }

        return {
            module: BlockchainModule,
            imports: [HttpModule],
            providers: [blockchainServiceProvider],
            exports: [blockchainServiceProvider],
        }
    }
}
