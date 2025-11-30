package com.ticketchain.controller;

import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/users")
@CrossOrigin(origins = "*") // Allow frontend access
public class UserController {

    @PostMapping
    public Map<String, String> registerUser(@RequestBody Map<String, Object> userData) {
        // TODO: Implement Google Sheets integration to save user
        Map<String, String> response = new HashMap<>();
        response.put("message", "User registered successfully (Mock)");
        response.put("walletAddress", (String) userData.get("walletAddress"));
        return response;
    }

    @GetMapping("/{walletAddress}")
    public Map<String, Object> getUser(@PathVariable String walletAddress) {
        // TODO: Implement Google Sheets integration to fetch user
        Map<String, Object> user = new HashMap<>();
        user.put("walletAddress", walletAddress);
        user.put("name", "Cyberpunk User");
        user.put("creditScore", 100);
        return user;
    }

    @GetMapping("/{walletAddress}/credits")
    public Map<String, Object> getCreditHistory(@PathVariable String walletAddress) {
        // TODO: Implement Google Sheets integration
        Map<String, Object> history = new HashMap<>();
        history.put("walletAddress", walletAddress);
        history.put("history", new Object[]{});
        return history;
    }
}
