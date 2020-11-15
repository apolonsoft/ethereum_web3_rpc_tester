import { IsUUID, IsNotEmpty } from 'class-validator'

export class LoggedDto {
    @IsUUID()
    uuid: string
}
