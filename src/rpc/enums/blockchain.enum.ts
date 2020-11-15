import { registerEnumType } from '@nestjs/graphql';

export enum Blockchain {
  ETHEREUM,
}

registerEnumType(Blockchain, {
  name: 'Blockchain',
});
