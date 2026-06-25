package com.chatbot.service;

import com.chatbot.dto.ChatRequest.ChatMessage;
import com.chatbot.dto.ChatResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DeepSeekService {

    private static final Logger log = LoggerFactory.getLogger(DeepSeekService.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final GeminiSearchService geminiSearchService;
    private final ConcurrentHashMap<String, List<ChatMessage>> conversations = new ConcurrentHashMap<>();

    @Value("${deepseek.api.url:https://api.deepseek.com/v1/chat/completions}")
    private String apiUrl;

    @Value("${deepseek.api.key}")
    private String apiKey;

    @Value("${deepseek.model:deepseek-chat}")
    private String model;

    public DeepSeekService(WebClient.Builder webClientBuilder,
                           ObjectMapper objectMapper,
                           GeminiSearchService geminiSearchService) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
        this.geminiSearchService = geminiSearchService;
    }

    // ──────────────────────────────────────────────
    // Tool / Function definitions for the LLM
    // ──────────────────────────────────────────────

    private ArrayNode buildTools() {
        ArrayNode tools = objectMapper.createArrayNode();

        // web_search tool
        ObjectNode searchTool = tools.addObject();
        searchTool.put("type", "function");

        ObjectNode fn = searchTool.putObject("function");
        fn.put("name", "web_search");
        fn.put("description", "Search the web for up-to-date information. Use this when you need " +
                "current facts, news, weather, sports scores, recent events, or any information " +
                "that may have changed since your training cutoff.");

        ObjectNode params = fn.putObject("parameters");
        params.put("type", "object");

        ObjectNode queryProp = params.putObject("properties");
        ObjectNode query = queryProp.putObject("query");
        query.put("type", "string");
        query.put("description", "The search query string");

        ArrayNode required = params.putArray("required");
        required.add("query");

        return tools;
    }

    // ──────────────────────────────────────────────
    // System prompt
    // ──────────────────────────────────────────────

    private static final String SYSTEM_PROMPT =
            "You are a helpful, intelligent assistant with access to web search. " +
            "You support both text and voice interactions. " +
            "Keep responses clear and concise. " +
            "When you need current or factual information beyond your training data, " +
            "use the web_search tool to find accurate up-to-date results. " +
            "After receiving search results, synthesize them into a clear answer.";

    // ──────────────────────────────────────────────
    // Main: send message (with optional web search)
    // ──────────────────────────────────────────────

    public ChatResult sendMessage(String message, String conversationId, List<ChatMessage> history) {
        String convId = (conversationId != null) ? conversationId : UUID.randomUUID().toString();

        int historySize = (history != null) ? history.size() : 0;
        String msgPreview = message.length() > 80 ? message.substring(0, 80) + "..." : message;
        log.info("Sending message to DeepSeek — conversationId={}, messageLength={}, historySize={}, preview=\"{}\"",
                convId, message.length(), historySize, msgPreview);

        // Build the messages array from history + current message
        List<ObjectNode> messageNodes = buildMessageList(message, history);

        // Send initial request with tools
        JsonNode response = callDeepSeek(messageNodes, true);
        long start = System.currentTimeMillis();

        // Process response — handle tool calls in a loop, accumulating tokens
        ChatResult result = processDeepSeekResponse(response, messageNodes, convId, 0);

        long elapsed = System.currentTimeMillis() - start;
        log.info("DeepSeek final response — conversationId={}, responseLength={} chars, totalTokens={}, totalTime={}ms",
                convId, result.getReply().length(), result.getTotalTokens(), elapsed);

        // Store conversation for continuation
        conversations.put(convId, List.of(
                new ChatMessage("user", message),
                new ChatMessage("assistant", result.getReply())
        ));

        return result;
    }

    // ──────────────────────────────────────────────
    // Build the conversation message list
    // ──────────────────────────────────────────────

    private List<ObjectNode> buildMessageList(String message, List<ChatMessage> history) {
        List<ObjectNode> nodes = new ArrayList<>();

        // System prompt
        ObjectNode systemMsg = objectMapper.createObjectNode();
        systemMsg.put("role", "system");
        systemMsg.put("content", SYSTEM_PROMPT);
        nodes.add(systemMsg);

        // Conversation history
        if (history != null && !history.isEmpty()) {
            for (ChatMessage msg : history) {
                ObjectNode histMsg = objectMapper.createObjectNode();
                histMsg.put("role", msg.getRole());
                histMsg.put("content", msg.getContent());
                nodes.add(histMsg);
            }
        }

        // Current user message
        ObjectNode userMsg = objectMapper.createObjectNode();
        userMsg.put("role", "user");
        userMsg.put("content", message);
        nodes.add(userMsg);

        return nodes;
    }

    // ──────────────────────────────────────────────
    // Call DeepSeek API
    // ──────────────────────────────────────────────

    private JsonNode callDeepSeek(List<ObjectNode> messages, boolean includeTools) {
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("model", model);

        ArrayNode msgArray = requestBody.putArray("messages");
        for (ObjectNode msg : messages) {
            msgArray.add(msg);
        }

        if (includeTools) {
            requestBody.set("tools", buildTools());
        }

        requestBody.put("max_tokens", 4096);
        requestBody.put("temperature", 0.7);

        return webClient.post()
                .uri(apiUrl)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
    }

    // ──────────────────────────────────────────────
    // Process DeepSeek response — handle tool calls
    // ──────────────────────────────────────────────

    /**
     * Extracts total tokens from a DeepSeek API response (usage.total_tokens).
     */
    private int extractTokens(JsonNode response) {
        if (response != null && response.has("usage") && response.get("usage").has("total_tokens")) {
            return response.get("usage").get("total_tokens").asInt(0);
        }
        return 0;
    }

    private ChatResult processDeepSeekResponse(JsonNode response,
                                               List<ObjectNode> messageNodes,
                                               String convId,
                                               int accumulatedTokens) {
        if (response == null || !response.has("choices") || !response.get("choices").isArray()
                || response.get("choices").size() == 0) {
            log.error("DeepSeek API returned unexpected response — conversationId={}, response={}",
                    convId, response);
            throw new RuntimeException("Failed to get response from DeepSeek API");
        }

        // Accumulate tokens from this API call
        int tokensThisCall = extractTokens(response);
        int totalTokens = accumulatedTokens + tokensThisCall;

        JsonNode choice = response.get("choices").get(0);
        JsonNode message = choice.get("message");
        String finishReason = choice.has("finish_reason") ? choice.get("finish_reason").asText() : "";

        // Add the assistant's response (with potential tool_calls) to the conversation
        messageNodes.add((ObjectNode) message);

        if ("tool_calls".equals(finishReason) && message.has("tool_calls")) {
            // The model wants to call one or more tools
            for (JsonNode toolCall : message.get("tool_calls")) {
                String functionName = toolCall.path("function").path("name").asText();
                String arguments = toolCall.path("function").path("arguments").asText();

                log.info("DeepSeek requested tool call — conversationId={}, function={}, arguments={}",
                        convId, functionName, arguments);

                if ("web_search".equals(functionName)) {
                    String query = extractQueryFromArgs(arguments);
                    log.info("Executing web search — conversationId={}, query=\"{}\"", convId, query);

                    // Execute the search via Gemini Grounding.
                    // If search fails (e.g. 503), GeminiSearchService throws
                    // a RuntimeException — this propagates up to the controller
                    // which returns a 503 to the frontend immediately,
                    // skipping the follow-up DeepSeek call entirely.
                    String searchResults = geminiSearchService.search(query);

                    // Add the tool result as a new message
                    ObjectNode toolResult = objectMapper.createObjectNode();
                    toolResult.put("role", "tool");
                    toolResult.put("tool_call_id", toolCall.get("id").asText());
                    toolResult.put("content", searchResults);
                    messageNodes.add(toolResult);

                    log.info("Web search result added to conversation — conversationId={}, resultLength={} chars",
                            convId, searchResults.length());
                } else {
                    log.warn("Unknown tool called — conversationId={}, function={}", convId, functionName);
                }
            }

            // Now call DeepSeek again WITHOUT tools to get the final answer
            log.info("DeepSeek tool call completed — making follow-up call, tokensSoFar={}", totalTokens);
            JsonNode followUpResponse = callDeepSeek(messageNodes, false);
            return processDeepSeekResponse(followUpResponse, messageNodes, convId, totalTokens);
        }

        // Normal text response
        if (message.has("content") && !message.get("content").isNull()) {
            String reply = message.get("content").asText();
            log.info("DeepSeek text response received — conversationId={}, responseLength={} chars, totalTokens={}",
                    convId, reply.length(), totalTokens);
            return new ChatResult(reply, totalTokens);
        }

        log.error("DeepSeek returned unexpected message format — conversationId={}, finish_reason={}, message={}",
                convId, finishReason, message);
        throw new RuntimeException("Failed to get valid response from DeepSeek API");
    }

    // ──────────────────────────────────────────────
    // Extract the "query" field from JSON arguments
    // ──────────────────────────────────────────────

    private String extractQueryFromArgs(String arguments) {
        try {
            JsonNode args = objectMapper.readTree(arguments);
            if (args.has("query")) {
                return args.get("query").asText();
            }
        } catch (Exception e) {
            log.warn("Failed to parse tool call arguments: {}", e.getMessage());
        }
        // Fallback: use raw arguments as query
        return arguments;
    }

    // ──────────────────────────────────────────────
    // Conversation ID management
    // ──────────────────────────────────────────────

    public String getConversationId(String existingId) {
        return (existingId != null && conversations.containsKey(existingId))
                ? existingId
                : UUID.randomUUID().toString();
    }
}
