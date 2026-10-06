// Runtime setup for the compiled standalone app, mirroring Pi's own Bun binary
// (pi-coding-agent src/bun/runtime-setup.ts). A compiled binary cannot load Pi's Bun OAuth
// flows or the Bedrock provider lazily, so they are registered up front. Pi's embedded QuickJS
// wasm path is not public API, so codemode does not work in the compiled app.
import { bedrockProviderModule } from '@earendil-works/pi-ai/bedrock-provider';
import { registerBunOAuthFlows } from '@earendil-works/pi-ai/bun-oauth';
import { setBedrockProviderModule } from '@earendil-works/pi-ai/compat';

registerBunOAuthFlows();
setBedrockProviderModule(bedrockProviderModule);
