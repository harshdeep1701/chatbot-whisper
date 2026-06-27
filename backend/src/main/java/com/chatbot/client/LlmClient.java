package com.chatbot.client;

import com.chatbot.config.properties.LlmProperties;
import com.chatbot.exception.LlmException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

@Component
public class LlmClient {

    private static final Logger log = LoggerFactory.getLogger(LlmClient.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final LlmProperties properties;

    public LlmClient(WebClient.Builder webClientBuilder, ObjectMapper objectMapper, LlmProperties properties) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public JsonNode chat(List<ObjectNode> messages, boolean includeTools) {
        var requestBody = objectMapper.createObjectNode();
        requestBody.put("model", properties.model());

        var msgArray = requestBody.putArray("messages");
        messages.forEach(msgArray::add);

        if (includeTools) {
            requestBody.set("tools", buildTools());
        }

        requestBody.put("max_tokens", properties.maxTokens());
        requestBody.put("temperature", properties.temperature());

        log.info("LLM request: model={}, messages={}, includeTools={}",
                properties.model(), messages.size(), includeTools);

        try {
            var response = webClient.post()
                    .uri(properties.apiUrl())
                    .header("Authorization", "Bearer " + properties.apiKey())
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();
            log.info("LLM response received: model={}", properties.model());
            return response;
        } catch (Exception e) {
            log.error("LLM call failed: model={}, error={}", properties.model(), e.getMessage());
            throw new LlmException("DeepSeek API call failed: " + e.getMessage(), e);
        }
    }

    public static int extractTotalTokens(JsonNode response) {
        if (response != null && response.has("usage") && response.get("usage").has("total_tokens")) {
            return response.get("usage").get("total_tokens").asInt(0);
        }
        return 0;
    }

    private ArrayNode buildTools() {
        var tools = objectMapper.createArrayNode();
        var searchTool = tools.addObject();
        searchTool.put("type", "function");

        var fn = searchTool.putObject("function");
        fn.put("name", "web_search");
        fn.put("description", "Search the web for up-to-date information.");

        var params = fn.putObject("parameters");
        params.put("type", "object");
        var queryProp = params.putObject("properties");
        var query = queryProp.putObject("query");
        query.put("type", "string");
        query.put("description", "The search query string");
        params.putArray("required").add("query");

        return tools;
    }
}
