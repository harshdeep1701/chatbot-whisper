package com.chatbot.service;

import com.chatbot.client.LlmClient;
import com.chatbot.dto.ChatRequest.ChatMessage;
import com.chatbot.dto.ChatResult;
import com.chatbot.exception.LlmException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DeepSeekService {

    private static final Logger log = LoggerFactory.getLogger(DeepSeekService.class);

    private static final String SYSTEM_PROMPT = """
            You are a helpful, intelligent assistant with access to web search.
            You support both text and voice interactions.
            Keep responses clear and concise.
            When you need current or factual information beyond your training data,
            use the web_search tool to find accurate up-to-date results.
            After receiving search results, synthesize them into a clear answer.""";

    private final LlmClient llmClient;
    private final ObjectMapper objectMapper;
    private final GeminiSearchService geminiSearchService;
    private final ConcurrentHashMap<String, List<ChatMessage>> conversations = new ConcurrentHashMap<>();

    public DeepSeekService(LlmClient llmClient,
                           ObjectMapper objectMapper,
                           GeminiSearchService geminiSearchService) {
        this.llmClient = llmClient;
        this.objectMapper = objectMapper;
        this.geminiSearchService = geminiSearchService;
    }

    public ChatResult sendMessage(String message, String conversationId, List<ChatMessage> history) {
        var convId = resolveConversationId(conversationId);
        var historySize = history != null ? history.size() : 0;

        log.info("Sending message: user={}, conversationId={}, messageLength={}, historySize={}",
                conversationId, convId, message.length(), historySize);

        var messageNodes = buildMessageList(message, history);
        var response = llmClient.chat(messageNodes, true);
        var result = processResponse(response, messageNodes, convId, 0);

        log.info("Response received: conversationId={}, responseLength={}, totalTokens={}",
                convId, result.reply().length(), result.totalTokens());

        conversations.put(convId, List.of(
                new ChatMessage("user", message),
                new ChatMessage("assistant", result.reply())
        ));

        return result;
    }

    public String getConversationId(String existingId) {
        return existingId != null && conversations.containsKey(existingId)
                ? existingId : UUID.randomUUID().toString();
    }

    private String resolveConversationId(String existingId) {
        return existingId != null ? existingId : UUID.randomUUID().toString();
    }

    private List<ObjectNode> buildMessageList(String message, List<ChatMessage> history) {
        var nodes = new ArrayList<ObjectNode>();

        var systemMsg = objectMapper.createObjectNode();
        systemMsg.put("role", "system");
        systemMsg.put("content", SYSTEM_PROMPT);
        nodes.add(systemMsg);

        if (history != null) {
            for (var msg : history) {
                var histMsg = objectMapper.createObjectNode();
                histMsg.put("role", msg.role());
                histMsg.put("content", msg.content());
                nodes.add(histMsg);
            }
        }

        var userMsg = objectMapper.createObjectNode();
        userMsg.put("role", "user");
        userMsg.put("content", message);
        nodes.add(userMsg);

        return nodes;
    }

    private ChatResult processResponse(JsonNode response, List<ObjectNode> messageNodes,
                                       String convId, int accumulatedTokens) {
        if (response == null || !response.has("choices") || response.get("choices").isEmpty()) {
            log.error("Unexpected DeepSeek response: conversationId={}", convId);
            throw new LlmException("Failed to get response from DeepSeek API");
        }

        var choice = response.get("choices").get(0);
        var message = choice.get("message");
        var finishReason = choice.has("finish_reason") ? choice.get("finish_reason").asText() : "";
        var tokensThisCall = LlmClient.extractTotalTokens(response);
        var totalTokens = accumulatedTokens + tokensThisCall;

        messageNodes.add((ObjectNode) message);

        if ("tool_calls".equals(finishReason) && message.has("tool_calls")) {
            return handleToolCalls(message, messageNodes, convId, totalTokens);
        }

        if (message.has("content") && !message.get("content").isNull()) {
            var reply = message.get("content").asText();
            return new ChatResult(reply, totalTokens);
        }

        log.error("Unexpected message format: conversationId={}, finishReason={}", convId, finishReason);
        throw new LlmException("Failed to get valid response from DeepSeek API");
    }

    private ChatResult handleToolCalls(JsonNode message, List<ObjectNode> messageNodes,
                                       String convId, int totalTokens) {
        for (var toolCall : message.get("tool_calls")) {
            var functionName = toolCall.path("function").path("name").asText();
            var arguments = toolCall.path("function").path("arguments").asText();

            log.info("Tool call requested: conversationId={}, function={}", convId, functionName);

            if ("web_search".equals(functionName)) {
                var query = extractQueryFromArgs(arguments);
                log.info("Executing web search: conversationId={}, query=\"{}\"", convId, query);

                var searchResults = geminiSearchService.search(query);

                var toolResult = objectMapper.createObjectNode();
                toolResult.put("role", "tool");
                toolResult.put("tool_call_id", toolCall.get("id").asText());
                toolResult.put("content", searchResults);
                messageNodes.add(toolResult);

                log.info("Search result added: conversationId={}, resultLength={} chars", convId, searchResults.length());
            } else {
                log.warn("Unknown tool called: conversationId={}, function={}", convId, functionName);
            }
        }

        log.info("Tool calls completed, making follow-up call: conversationId={}, tokensSoFar={}", convId, totalTokens);
        var followUp = llmClient.chat(messageNodes, false);
        return processResponse(followUp, messageNodes, convId, totalTokens);
    }

    private String extractQueryFromArgs(String arguments) {
        try {
            var args = objectMapper.readTree(arguments);
            if (args.has("query")) {
                return args.get("query").asText();
            }
        } catch (Exception e) {
            log.warn("Failed to parse tool call arguments: {}", e.getMessage());
        }
        return arguments;
    }
}
