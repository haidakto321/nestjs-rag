import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface AiModuleOptions {
  ollamaBaseUrl: string;
  embeddingModel: string;
  embeddingDim: number;
  chatModel: string;
  chatThink: boolean;
}

// ConfigurableModuleBuilder writes forRoot/forRootAsync for us: the same mechanism that
// TypeOrmModule.forRootAsync and JwtModule.registerAsync use.
export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: AI_MODULE_OPTIONS,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<AiModuleOptions>()
  .setClassMethodName('forRoot')
  .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
  .build();
