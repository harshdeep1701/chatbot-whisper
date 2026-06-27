package com.chatbot.service;

import com.chatbot.config.properties.GeminiProperties;
import com.chatbot.dto.ChatRequest.ChatMessage;
import com.chatbot.exception.LlmException;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.googleai.GoogleAiGeminiChatModel;
import dev.langchain4j.model.googleai.GoogleAiGeminiChatResponseMetadata;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class GeminiSearchService {

    private static final Logger log = LoggerFactory.getLogger(GeminiSearchService.class);

    private ChatModel geminiModel;
    private final GeminiProperties properties;

    public GeminiSearchService(GeminiProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        log.info("Initializing Gemini model: model={}, googleSearch={}",
                properties.model(), properties.googleSearch());

        geminiModel = GoogleAiGeminiChatModel.builder()
                .apiKey(properties.apiKey())
                .modelName(properties.model())
                .allowGoogleSearch(properties.googleSearch())
                .logRequests(properties.logRequests())
                .logResponses(properties.logResponses())
                .build();
    }

    public String search(String query) {
        log.info("Web search requested: query=\"{}\"", query);

        var request = ChatRequest.builder()
                .messages(
                        SystemMessage.from("""
                                You are a web search tool. Return the factual search results
                                for the query below. List each source with its title, URL,
                                and relevant snippet. Do NOT add conversational filler,
                                opinions, or greetings. Just the facts."""),
                        UserMessage.from(query))
                .build();

        try {
            var response = geminiModel.chat(request);
            var results = response.aiMessage() != null ? response.aiMessage().text() : "";

            log.info("Search completed: query=\"{}\", resultsLength={} chars", query, results.length());
            logGroundingMetadata(response);
            return results;
        } catch (Exception e) {
            log.error("Web search failed: query=\"{}\", error={}", query, e.getMessage());
            throw new LlmException("Web search is temporarily unavailable. Error: " + e.getMessage());
        }
    }

    public String ask(String userMessage) {
        log.info("Gemini request: messageLength={} chars", userMessage.length());

        var request = ChatRequest.builder()
                .messages(UserMessage.from(userMessage))
                .build();

        var response = geminiModel.chat(request);
        var reply = response.aiMessage() != null ? response.aiMessage().text() : "";

        log.info("Gemini response: responseLength={} chars", reply.length());
        logGroundingMetadata(response);
        return reply;
    }

    public String askWithHistory(String userMessage, List<ChatMessage> history) {
        var messages = new ArrayList<dev.langchain4j.data.message.ChatMessage>();

        messages.add(SystemMessage.from(
                "You are a helpful assistant with access to Google Search. " +
                "Use web search when you need up-to-date information. " +
                "Keep responses clear and concise."));

        if (history != null) {
            for (var msg : history) {
                switch (msg.role()) {
                    case "user" -> messages.add(UserMessage.from(msg.content()));
                    case "assistant" -> messages.add(AiMessage.from(msg.content()));
                }
            }
        }

        messages.add(UserMessage.from(userMessage));

        var request = ChatRequest.builder().messages(messages).build();
        var response = geminiModel.chat(request);
        var reply = response.aiMessage() != null ? response.aiMessage().text() : "";

        log.info("Gemini response (history): historySize={}, responseLength={} chars",
                history != null ? history.size() : 0, reply.length());

        logGroundingMetadata(response);
        return reply;
    }

    private void logGroundingMetadata(ChatResponse response) {
        if (!(response.metadata() instanceof GoogleAiGeminiChatResponseMetadata geminiMeta)) {
            return;
        }

        var groundingMeta = geminiMeta.groundingMetadata();
        if (groundingMeta == null) {
            log.debug("No grounding metadata — model answered from training data");
            return;
        }

        if (groundingMeta.webSearchQueries() != null && !groundingMeta.webSearchQueries().isEmpty()) {
            log.info("Google Search queries: [{}]",
                    String.join(" | ", groundingMeta.webSearchQueries()));
        }

        if (groundingMeta.groundingChunks() != null && !groundingMeta.groundingChunks().isEmpty()) {
            log.info("Sources used: {} source(s)", groundingMeta.groundingChunks().size());
            for (var chunk : groundingMeta.groundingChunks()) {
                if (chunk.web() != null) {
                    log.info("  • {} — {}", chunk.web().uri(), chunk.web().title());
                }
            }
        }
    }
}

