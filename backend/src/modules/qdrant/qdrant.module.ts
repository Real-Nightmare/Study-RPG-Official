import { Global, Module } from '@nestjs/common';
import { QdrantService } from './qdrant.service';
import { CollectionResolver } from './collection-resolver.service';

@Global()
@Module({
  providers: [QdrantService, CollectionResolver],
  exports: [QdrantService, CollectionResolver],
})
export class QdrantModule {}
