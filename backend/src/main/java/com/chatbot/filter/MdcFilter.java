package com.chatbot.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
public class MdcFilter extends OncePerRequestFilter implements Ordered {

    private static final String USER_ID_KEY = "userId";
    private static final String REQUEST_ID_KEY = "requestId";

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            var auth = request.getUserPrincipal();
            var userId = auth != null ? auth.getName() : "anonymous";
            var requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);

            MDC.put(USER_ID_KEY, userId);
            MDC.put(REQUEST_ID_KEY, requestId);

            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(USER_ID_KEY);
            MDC.remove(REQUEST_ID_KEY);
        }
    }
}
