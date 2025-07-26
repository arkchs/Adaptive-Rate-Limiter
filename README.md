Adaptive Rate Limiter: Dynamic Traffic Management

This project implements an adaptive rate limiter designed to dynamically adjust API request limits for clients based on their real-time behavior. Unlike traditional static rate limiters, this system identifies and responds to different traffic patterns, allowing for more flexible and robust API protection.
Table of Contents

    Project Overview

    Core Components

        Backend Server (adaptive_rate_limiter.js)

        Anomaly Detection Worker (traffic_worker.js)

    How it Works: The Adaptive Logic

        Overall Request Flow

        Adaptive Limit Adjustment Flow

    Client Profiles for Simulation

        Profile Details

        IP Address Ranges

    Setup and Running the Project

        Prerequisites

        Backend Setup

        k6 Test Script Setup

    Simulating Client Behavior

        Manual k6 Simulation

        Triggering Simulations from an External App (e.g., Flutter)

    Monitoring and Verification

        Server Console Logs

        /limits Endpoint

1. Project Overview

The Adaptive Rate Limiter is a Node.js Express application that uses Redis for distributed rate limiting and Node.js worker threads for asynchronous anomaly detection. Its primary goal is to:

    Prevent Abuse: Protect the API from malicious attacks (e.g., DDoS, brute-force).

    Improve Fairness: Dynamically allocate resources by throttling misbehaving clients while potentially increasing limits for well-behaved ones.

    Provide Flexibility: Adapt to changing traffic patterns without requiring manual configuration updates.

2. Core Components

The system is composed of two main JavaScript files and a Redis instance:
Backend Server (adaptive_rate_limiter.js)

This is the main Express.js application that handles incoming HTTP requests.

    Request Processing: Intercepts every incoming request to apply rate limiting.

    Redis Integration: Uses ioredis to manage request counts within a sliding window and to store IP ban statuses. Redis ensures that rate limits are consistent across multiple instances of the Node.js application (if scaled horizontally).

    Worker Pool Management: Creates and manages a pool of traffic_worker.js threads. It distributes incoming request logs to these workers for asynchronous anomaly detection using a round-robin approach.

    Adaptive Limit Enforcement: Listens for messages from the worker threads. Based on the anomaly detection results (ban, decrease, increase), it updates the rateLimits Map (in-memory) and sets/removes ban entries in Redis.

    Endpoints:

        GET /test: A simple endpoint to receive test requests.

        GET /limits: Displays the current adaptive rate limits for all tracked IP addresses.

        POST /start-simulation: A control endpoint (designed for external apps like Flutter) to trigger specific k6 test profiles.

Anomaly Detection Worker (traffic_worker.js)

These are independent Node.js worker threads that perform the CPU-intensive task of analyzing traffic patterns.

    Asynchronous Analysis: Receives request logs from the main server and performs anomaly detection without blocking the main event loop.

    Traffic Statistics: Maintains a Map (trafficStats) to store recent request timestamps for each IP address within a defined WINDOW (1 minute).

    Z-score Calculation: Calculates the Z-score for each IP. The Z-score measures how many standard deviations an IP's request count deviates from the mean request count of all IPs currently being tracked by that specific worker.

    Anomaly Classification: Based on the calculated Z-score and request count, it determines if an IP exhibits anomalous behavior and recommends an action:

        'ban': For extremely high Z-scores and high counts.

        'decrease': For moderately high Z-scores.

        'increase': For significantly low Z-scores and very low counts (indicating a well-behaved client).

    Communication: Sends messages back to the parent thread (adaptive_rate_limiter.js) when an anomaly is detected, including the IP and the recommended action.

3. How it Works: The Adaptive Logic
Overall Request Flow

graph TD
    A[Client Request (e.g., k6 VU)] --> B(Node.js Server: adaptive_rate_limiter.js)
    B --> C{Is IP Banned in Redis?}
    C -- Yes --> D[Respond 429: IP Banned]
    C -- No --> E{Get Current Rate Limit for IP}
    E --> F[Increment Request Count in Redis (Sliding Window)]
    F --> G{Is Count > Limit?}
    G -- Yes --> D
    G -- No --> H[Send Request Log to Worker Thread]
    H --> I[Continue to API Endpoint Logic]
    I --> J[Respond 200 OK]

Adaptive Limit Adjustment Flow

graph TD
    A[Request Log Sent to Worker] --> B(traffic_worker.js: detectAnomaly function)
    B --> C{Update IP's Request Timestamps}
    C --> D[Calculate Mean & Std Dev of all tracked IPs]
    D --> E[Calculate Z-score for current IP]
    E --> F{Z-score & Count Analysis}
    F -- Z > Z_THRESHOLD & Count > 20 --> G[Recommend 'ban' Action]
    F -- Z > 1.0 --> H[Recommend 'decrease' Action]
    F -- Z < -1 & Count < 5 --> I[Recommend 'increase' Action]
    F -- Else --> J[No Anomaly Detected]
    G --> K(Worker Sends Message to Main Server)
    H --> K
    I --> K
    K --> L(Main Server: Worker Message Listener)
    L --> M{Update Server's in-memory rateLimits Map}
    L --> N{Update Redis Ban Status (if 'ban' action)}

4. Client Profiles for Simulation

To effectively test the adaptive nature of the rate limiter, five distinct client profiles are defined in the k6 script. Each profile simulates a different traffic pattern, designed to trigger specific adaptive responses from the system.
Profile Details

Profile Name
	

k6 VUs
	

Request Rate (Approx.)
	

Expected Server Response (Adaptive Limit)
	

X-Forwarded-For IP Range

Good Client
	

20
	

12 req/min
	

Increase (e.g., to 200)
	

192.168.1.0 - 192.168.1.19

Normal Client
	

20
	

60 req/min
	

Stay Default/Increase (e.g., to 200)
	

192.168.2.0 - 192.168.2.19

Slightly Bad Client
	

20
	

200 req/min
	

Decrease (e.g., to 20)
	

192.168.3.0 - 192.168.3.19

Extremely Bad Client
	

20
	

1200 req/min
	

Ban / Severe Decrease (e.g., to 20)
	

192.168.4.0 - 192.168.4.19

Spiky Client
	

20
	

Varies (spike to 600 req/min)
	

Decrease during spike, then recover/stabilize
	

192.168.5.0 - 192.168.5.19
IP Address Ranges

Each profile is assigned a unique IP address range using the X-Forwarded-For header. This ensures that the traffic_worker.js can track and analyze the behavior of each profile independently.

    192.168.1.x: Good Client

    192.168.2.x: Normal Client

    192.168.3.x: Slightly Bad Client

    192.168.4.x: Extremely Bad Client

    192.168.5.x: Spiky Client

5. Setup and Running the Project
Prerequisites

    Node.js: (LTS version recommended)

    npm or Yarn: (Package manager for Node.js)

    Redis Server: Running locally or accessible via REDIS_URL.

    k6: Load testing tool. Installation Guide

Backend Setup

    Clone/Download Project: Get the adaptive_rate_limiter.js and traffic_worker.js files.

    Install Dependencies:

    npm init -y
    npm install express ioredis

    Ensure trust proxy is enabled: In adaptive_rate_limiter.js, ensure the following line is present early in your Express app setup:

    app.set('trust proxy', true);

    Adjust Worker Thresholds (Optional, but recommended for testing):
    In traffic_worker.js, you might want to adjust the Z-score thresholds for easier anomaly detection during testing:

    // traffic_worker.js
    const Z_THRESHOLD = 1.8; // For banning (was 3)
    // ...
    } else if (z > 1.0) { // For DECREASE (was 2)
    // ...

    Start the Server:

    node adaptive_rate_limiter.js

    The server should start on http://localhost:5000 (or your configured PORT).

k6 Test Script Setup

    Create tests Directory: Create a folder named tests in the same directory as your Node.js files.

    Create testing.js: Inside the tests directory, create a file named testing.js and paste the updated k6 script content (from Section 6.1).

6. Simulating Client Behavior

You can trigger the simulations in two ways: manually via the command line, or programmatically via a dedicated Node.js endpoint (ideal for integration with a UI like Flutter).
Manual k6 Simulation

To run a specific client profile manually using k6, use the K6_PROFILE environment variable:

# Simulate Good Clients
K6_PROFILE=good k6 run tests/testing.js

# Simulate Normal Clients
K6_PROFILE=normal k6 run tests/testing.js

# Simulate Slightly Bad Clients
K6_PROFILE=slightly_bad k6 run tests/testing.js

# Simulate Extremely Bad Clients
K6_PROFILE=extremely_bad k6 run tests/testing.js

# Simulate Spiky Clients
K6_PROFILE=spiky k6 run tests/testing.js

You can run multiple of these commands in separate terminal windows concurrently to simulate mixed traffic.
Triggering Simulations from an External App (e.g., Flutter)

Your Node.js backend includes a POST /start-simulation endpoint specifically for this purpose.

    Endpoint: POST http://localhost:5000/start-simulation

    Request Body (JSON):

    {
      "profile": "good", // or "normal", "slightly_bad", "extremely_bad", "spiky"
      "duration": "60s"  // Optional: override default k6 duration
    }

    Example Flutter Integration:
    Your Flutter application would make an HTTP POST request to this endpoint when a user taps a button. The Node.js server will then spawn a k6 process in the background to run the specified simulation.

    // Example Flutter code snippet (requires http package)
    import 'package:http/http.dart' as http;
    import 'dart:convert';

    Future<void> startSimulation(String profile) async {
      final url = Uri.parse('http://localhost:5000/start-simulation'); // Adjust to your server IP
      try {
        final response = await http.post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: json.encode({'profile': profile, 'duration': '60s'}),
        );

        if (response.statusCode == 200) {
          print('Simulation started for $profile: ${response.body}');
          // Update UI: "Simulation running..."
        } else {
          print('Failed to start simulation for $profile: ${response.statusCode} - ${response.body}');
          // Update UI: Show error
        }
      } catch (e) {
        print('Error sending simulation request: $e');
        // Update UI: Handle network errors
      }
    }

    // Example usage in a Flutter button:
    // ElevatedButton(
    //   onPressed: () => startSimulation('extremely_bad'),
    //   child: Text('Simulate DDoS Attack'),
    // ),

7. Monitoring and Verification

To observe the adaptive behavior, monitor your server logs and the /limits endpoint.
Server Console Logs

Keep the terminal running your adaptive_rate_limiter.js server open. You will see:

    Worker processing IP: ...: Detailed logs from traffic_worker.js showing the Count, Mean, Std, and Z-score for each IP being analyzed. This helps understand why an anomaly is (or isn't) detected.

    Anomaly detected for IP ...: [action]: Messages indicating when an IP has crossed a threshold and an adaptive action (decrease, increase, ban) is being applied.

    [SIMULATION] Starting k6 simulation...: Logs from the /start-simulation endpoint confirming that a k6 test has been triggered.

/limits Endpoint

    Endpoint: GET http://localhost:5000/limits

    Usage: Hit this endpoint periodically (e.g., every few seconds) using your browser or Postman while simulations are running.

    Expected Output: You will see a JSON object where keys are IP addresses (e.g., 192.168.1.5) and values are their current adaptive rate limits. Observe how these limits change over time based on the simulated client behavior.

By combining these monitoring techniques, you can clearly visualize and verify the dynamic adjustments made by your adaptive rate limiter.