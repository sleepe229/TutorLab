package project.TutorLab.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SecurityHeadersFilterTest {

    private SecurityHeadersFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        filter = new SecurityHeadersFilter();
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    private void doFilter() throws IOException, ServletException {
        filter.doFilter(request, response, new MockFilterChain());
    }

    @Test
    void doFilter_setsXContentTypeOptions() throws Exception {
        doFilter();
        assertEquals("nosniff", response.getHeader("X-Content-Type-Options"));
    }

    @Test
    void doFilter_setsXFrameOptions() throws Exception {
        doFilter();
        assertEquals("DENY", response.getHeader("X-Frame-Options"));
    }

    @Test
    void doFilter_setsReferrerPolicy() throws Exception {
        doFilter();
        assertEquals("strict-origin-when-cross-origin", response.getHeader("Referrer-Policy"));
    }

    @Test
    void doFilter_setsContentSecurityPolicy() throws Exception {
        doFilter();
        String csp = response.getHeader("Content-Security-Policy");
        assertNotNull(csp);
        assertTrue(csp.contains("default-src 'self'"));
        assertTrue(csp.contains("script-src"));
    }

    @Test
    void doFilter_setsStrictTransportSecurity() throws Exception {
        doFilter();
        String hsts = response.getHeader("Strict-Transport-Security");
        assertNotNull(hsts);
        assertTrue(hsts.contains("max-age="));
    }

    @Test
    void doFilter_invokesFilterChain() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }
}
