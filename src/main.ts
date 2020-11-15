import 'dotenv/config'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import { AppModule } from './app.module'

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    if (process.env.RMQ_ACTIONS_URLS) {
        app.connectMicroservice({
            transport: Transport.RMQ,
            options: {
                urls: JSON.parse(process.env.RMQ_ACTIONS_URLS),
                queue: 'action',
                noAck: false,
                queueOptions: {
                    durable: false,
                },
            },
        })
    }
    app.useGlobalPipes(new ValidationPipe())
    await app.listen(process.env.PORT, process.env.HOST)
    app.startAllMicroservices()
}
bootstrap()
