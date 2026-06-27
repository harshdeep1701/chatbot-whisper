package com.chatbot.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RateLimitExceededException.class)
    public ProblemDetail handleRateLimitExceeded(RateLimitExceededException ex) {
        var problem = ProblemDetail.forStatus(HttpStatus.TOO_MANY_REQUESTS);
        problem.setTitle("Daily token limit reached");
        problem.setDetail(ex.getMessage());
        return problem;
    }

    @ExceptionHandler(LlmException.class)
    public ProblemDetail handleLlm(LlmException ex) {
        var problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problem.setTitle("LLM service error");
        problem.setDetail(ex.getMessage());
        return problem;
    }

    @ExceptionHandler(SttException.class)
    public ProblemDetail handleStt(SttException ex) {
        var problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problem.setTitle("Speech-to-text failed");
        problem.setDetail(ex.getMessage());
        return problem;
    }

    @ExceptionHandler(TtsException.class)
    public ProblemDetail handleTts(TtsException ex) {
        var problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problem.setTitle("Text-to-speech failed");
        problem.setDetail(ex.getMessage());
        return problem;
    }

    @ExceptionHandler(AuthException.class)
    public ProblemDetail handleAuth(AuthException ex) {
        var problem = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        problem.setTitle("Authentication failed");
        problem.setDetail(ex.getMessage());
        return problem;
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ProblemDetail handleUserNotFound(UserNotFoundException ex) {
        var problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle("User not found");
        problem.setDetail(ex.getMessage());
        return problem;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleBadRequest(IllegalArgumentException ex) {
        var problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Bad request");
        problem.setDetail(ex.getMessage());
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneric(Exception ex) {
        var problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problem.setTitle("Internal server error");
        problem.setDetail("An unexpected error occurred");
        return problem;
    }
}
