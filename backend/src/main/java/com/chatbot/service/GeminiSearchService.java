package com.chatbot.service;

import com.chatbot.dto.ChatRequest.ChatMessage;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.googleai.GoogleAiGeminiChatModel;
import dev.langchain4j.model.googleai.GoogleAiGeminiChatResponseMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;

/**
 * Service that uses LangChain4j's {@code GoogleAiGeminiChatModel} with
 * <b>Google Search Grounding</b> enabled.
 * <p>
 * When Gemini needs real-time or fresh information, it automatically
 * performs a Google Search and grounds its answer in the search results.
 * The grounding sources can be inspected via the
 * {@link GoogleAiGeminiChatResponseMetadata#groundingMetadata()} property.
 * <p>
 * <b>Required dependency:</b>
 * <pre>{@code
 * <dependency>
 *     <groupId>dev.langchain4j</groupId>
 *     <artifactId>langchain4j-google-ai-gemini</artifactId>
 *     <version>1.16.3</version>
 * </dependency>
 * }</pre>
 */
@Service
public class GeminiSearchService {

    private static final Logger log = LoggerFactory.getLogger(GeminiSearchService.class);

    private ChatModel geminiModel;

    @Value("${google.gemini.api-key}")
    private String apiKey;

    @Value("${google.gemini.model:gemini-1.5-flash}")
    private String modelName;

    @Value("${google.gemini.google-search:true}")
    private boolean googleSearchEnabled;

    @Value("${google.gemini.log-requests:false}")
    private boolean logRequests;

    @Value("${google.gemini.log-responses:false}")
    private boolean logResponses;

    // ==================================================================
    //  1.  INITIALIZE — build the Gemini model with Google Search
    // ==================================================================

    /**
     * Initialises the {@code GoogleAiGeminiChatModel} with Google Search
     * Grounding turned on.  The builder method {@code .allowGoogleSearch(true)}
     * tells Gemini to autonomously decide when it needs to search the web.
     * No manual tool-call orchestration is required on the developer side.
     */
    @PostConstruct
    public void init() {
        log.info("Initializing GoogleAiGeminiChatModel — model={}, googleSearch={}",
                modelName, googleSearchEnabled);

        geminiModel = GoogleAiGeminiChatModel.builder()
                .apiKey(apiKey)
                .modelName(modelName)
                .allowGoogleSearch(googleSearchEnabled)   // ← enables Google Search Grounding
                .logRequests(logRequests)
                .logResponses(logResponses)
                .build();

        log.info("GoogleAiGeminiChatModel initialized successfully");
    }

    // ==================================================================
    //  2.  CHAT — send a user query, get a grounded response
    // ==================================================================

    /**
     * Performs a Google Search via Gemini's Grounding and returns the raw
     * search facts — not a conversational answer.  This is designed for
     * programmatic consumption (e.g. fed back to DeepSeek as tool result).
     *
     * @param query the search query
     * @return factual search results as plain text
     */
    public String search(String query) {
        log.info("Gemini Search Grounding — query=\"{}\"", query);
        long start = System.currentTimeMillis();

        try {
            // Instruct Gemini to return only the factual search results,
            // not a conversational summary — this output will be consumed
            // by DeepSeek as a tool result for final synthesis.
            ChatRequest request = ChatRequest.builder()
                    .messages(
                            SystemMessage.from(
                                    "You are a web search tool. Return the factual search results " +
                                    "for the query below. List each source with its title, URL, " +
                                    "and relevant snippet. Do NOT add conversational filler, " +
                                    "opinions, or greetings. Just the facts."),
                            UserMessage.from(query))
                    .build();

            ChatResponse response = geminiModel.chat(request);
            long elapsed = System.currentTimeMillis() - start;

            String results = response.aiMessage() != null
                    ? response.aiMessage().text()
                    : "";

            log.info("Gemini Search Grounding — query=\"{}\", resultsLength={} chars, took={}ms",
                    query, results.length(), elapsed);

            // Log which sources Gemini used
            logGroundingMetadata(response);

            return results;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("Gemini Search Grounding FAILED — query=\"{}\", took={}ms, error: {}",
                    query, elapsed, e.getMessage(), e);

            // Throw so DeepSeekService knows search failed and aborts
            // the DeepSeek call — no point feeding an error to the LLM.
            throw new RuntimeException("Web search is temporarily unavailable. " +
                    "Service error: " + e.getMessage());
        }
    }

    /**
     * Sends a single user message to Gemini.  The model will automatically
     * search Google when it needs up-to-date facts.
     *
     * @param userMessage the user's question or prompt
     * @return the model's reply text
     */
    public String ask(String userMessage) {
        String preview = userMessage.length() > 80
                ? userMessage.substring(0, 80) + "..."
                : userMessage;
        log.info("Gemini request — preview=\"{}\"", preview);

        long start = System.currentTimeMillis();

        ChatRequest request = ChatRequest.builder()
                .messages(UserMessage.from(userMessage))
                .build();

        ChatResponse response = geminiModel.chat(request);
        long elapsed = System.currentTimeMillis() - start;

        String reply = response.aiMessage() != null
                ? response.aiMessage().text()
                : "";

        log.info("Gemini response — responseLength={} chars, took={}ms",
                reply.length(), elapsed);

        // Inspect grounding metadata (search sources the model used)
        logGroundingMetadata(response);

        return reply;
    }

    /**
     * Sends a message with conversation history so the model has context.
     *
     * @param userMessage the current user question
     * @param history     previous messages (role + content pairs)
     * @return the model's reply text
     */
    public String askWithHistory(String userMessage, List<ChatMessage> history) {
        List<dev.langchain4j.data.message.ChatMessage> messages = new ArrayList<>();

        // System-level instruction
        messages.add(SystemMessage.from(
                "You are a helpful assistant with access to Google Search. " +
                "Use web search when you need up-to-date information. " +
                "Keep responses clear and concise."));

        // Replay previous conversation turns
        if (history != null) {
            for (ChatMessage msg : history) {
                if ("user".equals(msg.getRole())) {
                    messages.add(UserMessage.from(msg.getContent()));
                } else if ("assistant".equals(msg.getRole())) {
                    messages.add(AiMessage.from(msg.getContent()));
                }
            }
        }

        messages.add(UserMessage.from(userMessage));

        ChatRequest request = ChatRequest.builder()
                .messages(messages)
                .build();

        long start = System.currentTimeMillis();
        ChatResponse response = geminiModel.chat(request);
        long elapsed = System.currentTimeMillis() - start;

        String reply = response.aiMessage() != null
                ? response.aiMessage().text()
                : "";

        log.info("Gemini response (history) — historySize={}, responseLength={} chars, took={}ms",
                history != null ? history.size() : 0, reply.length(), elapsed);

        logGroundingMetadata(response);

        return reply;
    }

    // ==================================================================
    //  3.  GROUNDING METADATA — inspect the search sources Gemini used
    // ==================================================================

    /**
     * Extracts and logs the Google Search Grounding metadata from the
     * {@link ChatResponse}.  This shows which web sources the model
     * consulted and which parts of its answer are grounded in those sources.
     */
    private void logGroundingMetadata(ChatResponse response) {
        // The standard ChatResponseMetadata is cast to the Gemini-specific
        // subclass that carries the extra grounding information.
        if (!(response.metadata() instanceof GoogleAiGeminiChatResponseMetadata geminiMeta)) {
            return;  // not a Gemini response → no grounding metadata
        }

        var groundingMeta = geminiMeta.groundingMetadata();
        if (groundingMeta == null) {
            log.debug("No grounding metadata — model answered from training data");
            return;
        }

        // (a) Search queries that Gemini issued
        if (groundingMeta.webSearchQueries() != null && !groundingMeta.webSearchQueries().isEmpty()) {
            log.info("Google Search queries: [{}]",
                    String.join(" | ", groundingMeta.webSearchQueries()));
        }

        // (b) Web sources returned by those queries
        if (groundingMeta.groundingChunks() != null && !groundingMeta.groundingChunks().isEmpty()) {
            log.info("Google Search Grounding — {} source(s) used:",
                    groundingMeta.groundingChunks().size());
            for (var chunk : groundingMeta.groundingChunks()) {
                if (chunk.web() != null) {
                    log.info("  • {} — {}", chunk.web().uri(), chunk.web().title());
                }
            }
        }

        // (c) Fine-grained support: which answer segments map to which chunks
        if (groundingMeta.groundingSupports() != null && !groundingMeta.groundingSupports().isEmpty()) {
            log.debug("Grounding support segments: {}", groundingMeta.groundingSupports().size());
            for (var support : groundingMeta.groundingSupports()) {
                if (support.segment() != null && support.segment().text() != null) {
                    log.debug("  Segment: \"{}\" → chunk indices: {}",
                            support.segment().text(),
                            support.groundingChunkIndices());
                }
            }
        }
    }
}

