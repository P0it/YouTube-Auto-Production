/**
 * 기존 호출처 호환용 facade. 신규 코드는 `./llm-router`의 `llm()` / `llmStream()`을
 * 직접 사용해 태스크 기반 라우팅을 받아야 한다. 이 파일은 기존 경로(Ollama 직접 호출)를
 * 그대로 유지해서 마이그레이션 중 기존 스크립트가 깨지지 않게 한다.
 */
export {
  loadOllamaConfig as loadConfig,
  checkOllamaStatus,
  generateText,
  streamGenerate,
  type OllamaConfig as LlmConfig,
  type OllamaGenerateResult as GenerateResult,
} from "./llm-ollama";

export { llm, llmStream, routeFor } from "./llm-router";
export type { LlmTask, LlmStrategy, LlmCallInput, LlmRouteDecision } from "./llm-router";
