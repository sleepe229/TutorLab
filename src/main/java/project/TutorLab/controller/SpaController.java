package project.TutorLab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Forwards all non-API, non-actuator routes to index.html
 * so that React Router handles client-side navigation.
 */
@Controller
public class SpaController {

    @RequestMapping(value = {
        "/home",
        "/settings",
        "/student/**",
        "/live/**",
        "/schedule",
        "/s/**",
        "/me",
        "/invite/**",
        "/join/**",
        "/chat",
        "/tutor/**"
    })
    public String forwardToSpa() {
        return "forward:/index.html";
    }
}
