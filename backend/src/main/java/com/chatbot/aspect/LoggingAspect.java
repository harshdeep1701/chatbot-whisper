package com.chatbot.aspect;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.stream.Collectors;

@Aspect
@Component
public class LoggingAspect {

    private static final Logger log = LoggerFactory.getLogger(LoggingAspect.class);

    // ──────────────────────────────────────────────
    // Pointcuts
    // ──────────────────────────────────────────────

    /** All methods in any @Service class */
    @Pointcut("within(@org.springframework.stereotype.Service *)")
    public void serviceMethods() {}

    /** All methods in any @RestController class */
    @Pointcut("within(@org.springframework.web.bind.annotation.RestController *)")
    public void controllerMethods() {}

    /** All methods in the three LLM / external-API service classes */
    @Pointcut("within(com.chatbot.service.DeepSeekService)")
    public void deepSeekService() {}

    @Pointcut("within(com.chatbot.service.WhisperService)")
    public void whisperService() {}

    @Pointcut("within(com.chatbot.service.TextToSpeechService)")
    public void ttsService() {}

    /** Union: any LLM API service */
    @Pointcut("deepSeekService() || whisperService() || ttsService()")
    public void llmApiServices() {}

    /** General: every service + controller method (excluding LLM services — they get their own advice) */
    @Pointcut("(serviceMethods() || controllerMethods()) && !llmApiServices()")
    public void generalBusinessMethods() {}

    // ──────────────────────────────────────────────
    // Advice 1 — General entry / exit logging
    // ──────────────────────────────────────────────

    @Around("generalBusinessMethods()")
    public Object logEntryExit(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String fullMethod = className + "." + methodName;

        log.debug(">>> ENTER {}({})", fullMethod, argsAsString(joinPoint.getArgs()));

        long start = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long elapsed = System.currentTimeMillis() - start;
            log.debug("<<< EXIT  {}  ─ took {} ms", fullMethod, elapsed);
            return result;
        } catch (Throwable t) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("<<< EXIT  {}  ─ threw {} after {} ms: {}", fullMethod,
                    t.getClass().getSimpleName(), elapsed, t.getMessage());
            throw t;
        }
    }

    // ──────────────────────────────────────────────
    // Advice 2 — LLM API detailed logging
    //              (input, output, timing)
    // ──────────────────────────────────────────────

    @Around("llmApiServices()")
    public Object logLlmApiCall(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String fullMethod = className + "." + methodName;

        // ── Log input ──
        log.info("╔══════════════════════════════════════════════════════");
        log.info("║  LLM CALL  {}()", fullMethod);
        log.info("╠══════════════════════════════════════════════════════");
        log.info("║  INPUT:");
        for (int i = 0; i < joinPoint.getArgs().length; i++) {
            Object arg = joinPoint.getArgs()[i];
            if (arg != null) {
                String argStr = safeArgToString(arg);
                log.info("║    [arg-{}] type={}  {}", i, arg.getClass().getSimpleName(), argStr);
            } else {
                log.info("║    [arg-{}] null", i);
            }
        }

        // ── Execute ──
        long start = System.nanoTime();
        try {
            Object result = joinPoint.proceed();
            long elapsedNs = System.nanoTime() - start;
            long elapsedMs = elapsedNs / 1_000_000;

            // ── Log output ──
            String resultStr = (result != null) ? truncate(result.toString(), 2000) : "null";
            log.info("║  OUTPUT: {}", resultStr);
            log.info("║  TIME:   {} ms ({} ns)", elapsedMs, elapsedNs);
            log.info("╚══════════════════════════════════════════════════════");

            return result;
        } catch (Throwable t) {
            long elapsedNs = System.nanoTime() - start;
            long elapsedMs = elapsedNs / 1_000_000;

            log.info("║  ERROR:  {} — {}", t.getClass().getSimpleName(), t.getMessage());
            log.info("║  TIME:   {} ms ({} ns)", elapsedMs, elapsedNs);
            log.info("╚══════════════════════════════════════════════════════  FAILED");

            throw t;
        }
    }

    // ──────────────────────────────────────────────
    // Binary-safe helpers
    // ──────────────────────────────────────────────

    /**
     * Converts an argument to a log-safe string, masking binary content.
     */
    private static String safeArgToString(Object arg) {
        if (arg == null) return "null";

        // MultipartFile → mask binary, show metadata
        if (arg instanceof MultipartFile file) {
            return "MultipartFile(name=" + file.getOriginalFilename()
                    + ", size=" + file.getSize() + " bytes, contentType=" + file.getContentType() + ")";
        }

        // byte[] → show only size
        if (arg instanceof byte[] bytes) {
            return "byte[" + bytes.length + "]";
        }

        // ByteArrayResource (used by WhisperService)
        if (arg instanceof org.springframework.core.io.ByteArrayResource resource) {
            try {
                return "ByteArrayResource(size=" + resource.contentLength() + " bytes)";
            } catch (Exception e) {
                return "ByteArrayResource(sized unknown)";
            }
        }

        // Default: use toString truncated
        return truncate(arg.toString(), 500);
    }

    private static String argsAsString(Object[] args) {
        if (args == null || args.length == 0) return "";
        return Arrays.stream(args)
                .map(LoggingAspect::safeArgToString)
                .collect(Collectors.joining(", "));
    }

    private static String truncate(String s, int maxLen) {
        if (s == null) return "null";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "... [truncated " + (s.length() - maxLen) + " chars]";
    }
}
