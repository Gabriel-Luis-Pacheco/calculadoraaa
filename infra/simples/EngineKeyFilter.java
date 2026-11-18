package br.gov.serpro.rtc.config.security;

// Independently developed gateway protection, not part of the upstream Receita Federal source.
// Used only in the deployed Docker image of Simples Nacional.
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public final class EngineKeyFilter extends OncePerRequestFilter {
    @Value("\${RTC_ENGINE_SHARED_KEY:}")
    private String secret;

    @Value("\${RTC_ENGINE_PROTECTED:false}")
    private boolean protectedMode;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        // Without protection enabled this filter does not affect local upstream smoke tests.
        // In production the container explicitly sets RTC_ENGINE_PROTECTED=true.
        if (!protectedMode && (secret == null || secret.isEmpty())) {
            chain.doFilter(request, response);
            return;
        }
        if (secret == null || secret.length() < 32) {
            response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Engine security is not configured");
            return;
        }
        String candidate = request.getHeader("X-RTC-Engine-Key");
        byte[] actual = (candidate == null ? "" : candidate).getBytes(StandardCharsets.UTF_8);
        byte[] expected = secret.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(actual, expected)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Access denied");
            return;
        }
        chain.doFilter(request, response);
    }
}
