# Adaptive Rate Limiter: Dynamic Traffic Management

This project implements an **adaptive rate limiter** designed to dynamically adjust API request limits for clients based on their real-time behavior. Unlike traditional static rate limiters, this system identifies and responds to different traffic patterns, allowing for more flexible and robust API protection.

## Table of Contents

1.  [Project Overview](#1-project-overview)
2.  [Core Architectural Concepts](#2-core-architectural-concepts)
    * [Backend Server Role](#backend-server-role)
    * [Anomaly Detection Worker Role](#anomaly-detection-worker-role)
3.  [Operational Principles: The Adaptive Logic](#3-operational-principles-the-adaptive-logic)
    * [Overall Request Processing Flow](#overall-request-processing-flow)
    * [Adaptive Limit Adjustment Mechanism](#adaptive-limit-adjustment-mechanism)
4.  [Client Behavior Profiles for Simulation](#4-client-behavior-profiles-for-simulation)
    * [Profile Characteristics](#profile-characteristics)
    * [IP Address Allocation Strategy](#ip-address-allocation-strategy)
5.  [System Setup and Execution](#5-system-setup-and-execution)
    * [Prerequisites](#prerequisites)
    * [Backend Configuration](#backend-configuration)
    * [Simulation Environment Setup](#simulation-environment-setup)
6.  [Behavioral Simulation and Control](#6-behavioral-simulation-and-control)
    * [Direct Simulation Execution](#direct-simulation-execution)
    * [Remote Simulation Triggering](#remote-simulation-triggering)
7.  [Monitoring and Validation](#7-monitoring-and-validation)
    * [Server Activity Logs](#server-activity-logs)
    * [Current Limits Endpoint](#current-limits-endpoint)

---

## 1. Project Overview

The Adaptive Rate Limiter is a system built on Node.js principles, leveraging a distributed data store (Redis) and concurrent processing (Node.js worker threads). Its primary objectives are:

* **Abuse Prevention:** Safeguarding API resources against various forms of malicious traffic, such as denial-of-service attacks or brute-force attempts.
* **Resource Fairness:** Ensuring equitable resource distribution by dynamically throttling clients exhibiting undesirable behavior while potentially increasing access for well-behaved consumers.
* **Dynamic Adaptability:** Providing a flexible defense mechanism that automatically adjusts to evolving traffic patterns without requiring manual intervention.

## 2. Core Architectural Concepts

The system is conceptually divided into distinct components that collaborate to achieve adaptive rate limiting.

### Backend Server Role

This component acts as the primary API gateway, processing all incoming client requests.

* **Request Interception:** All API requests are first routed through this component for initial rate limit checks.
* **Distributed State Management:** It interacts with a Redis instance to maintain a consistent view of request counts over time and to track client ban statuses across potentially multiple server instances.
* **Workload Delegation:** It offloads the computationally intensive task of anomaly detection to a pool of specialized worker threads, ensuring the main request processing remains responsive.
* **Policy Enforcement:** Based on real-time feedback from the anomaly detection workers, it dynamically updates and applies rate limiting policies for individual clients.
* **Operational Endpoints:** Provides interfaces for API consumption, status monitoring, and external control of simulation tests.

### Anomaly Detection Worker Role

These are isolated, concurrent processing units responsible for sophisticated traffic analysis.

* **Asynchronous Analysis:** They receive streams of request data from the main server and perform statistical analysis without impeding the server's primary function.
* **Behavioral Profiling:** Each worker tracks the recent request history for various client IP addresses within a defined time window.
* **Statistical Deviation Calculation:** A key function involves calculating a Z-score for each client's request volume. This metric quantifies how significantly a client's activity deviates from the average activity observed across all clients.
* **Behavioral Classification:** Based on the Z-score and the client's total request count, the worker classifies the client's behavior and recommends a specific adaptive action:
    * **'ban'**: For severe, statistically significant deviations indicative of highly malicious activity.
    * **'decrease'**: For moderate, yet notable, deviations suggesting excessive or undesirable traffic.
    * **'increase'**: For clients exhibiting exceptionally low and consistent traffic, potentially allowing for higher resource allocation.
* **Inter-Component Communication:** Workers communicate their findings and recommended actions back to the main server.

## 3. Operational Principles: The Adaptive Logic

### Overall Request Processing Flow

A client initiates a request which first arrives at the Backend Server. The server immediately checks if the client's IP is currently banned. If so, the request is denied. Otherwise, the server consults its current rate limit for that IP and increments the client's request count within a sliding time window. If the client's request count exceeds its assigned limit, the request is denied. If the request is allowed, a log of this activity is asynchronously sent to an Anomaly Detection Worker, and the request proceeds to the intended API endpoint, eventually receiving a successful response.

*(Note: Conceptual flowcharts illustrating this process were included in previous versions but are omitted here to adhere to the "no code" constraint.)*

### Adaptive Limit Adjustment Mechanism

The adaptive logic operates in parallel to the main request flow, continuously refining client policies.

A request log is transmitted to an Anomaly Detection Worker. This worker updates its internal records of the client's recent activity. It then calculates statistical metrics (mean and standard deviation) across all clients it monitors. Using these statistics, a Z-score is computed for the specific client's request count, indicating its deviation from the norm. Based on this Z-score and the client's request volume, the worker classifies the behavior and recommends an adaptive action (ban, decrease, or increase). If an anomaly is detected, the worker communicates this recommendation back to the Backend Server. The server then updates its in-memory rate limit for that client and, if a 'ban' action was recommended, updates the client's ban status in Redis.

*(Note: Conceptual flowcharts illustrating this mechanism were included in previous versions but are omitted here to adhere to the "no code" constraint.)*

## 4. Client Behavior Profiles for Simulation

To rigorously test the adaptive rate limiter, five distinct client behavior profiles are defined. Each profile is designed to elicit a specific adaptive response from the system.

### Profile Characteristics

| **Profile Name** | **Simulated Request Rate (Approx.)** | **Expected Adaptive Limit Outcome** |
| :--------------- | :----------------------------------- | :------------------------------------------------------------ |
| **Good Client** | Very low (e.g., 12 req/min) | **Increase**: System should reward and raise their limit. |
| **Normal Client** | Moderate (e.g., 60 req/min) | **Stay Default/Increase**: System should maintain or slightly raise their limit. |
| **Slightly Bad Client** | Moderately high (e.g., 200 req/min) | **Decrease**: System should detect and lower their limit. |
| **Extremely Bad Client** | Very high (e.g., 1200 req/min) | **Ban / Severe Decrease**: System should aggressively throttle or ban. |
| **Spiky Client** | Variable (e.g., spike to 600 req/min) | **Decrease during spike, then gradual recovery/stabilization**. |

### IP Address Allocation Strategy

Each client profile is assigned a unique segment of IP addresses (e.g., `192.168.1.x`, `192.168.2.x`, etc.) through a standard HTTP header mechanism. This strategy ensures that the anomaly detection workers can independently track and analyze the behavior of each profile, allowing for clear differentiation in the adaptive policies applied.

## 5. System Setup and Execution

### Prerequisites

To set up and run this project, you will need:

* **Node.js:** A JavaScript runtime environment.
* **npm or Yarn:** Package managers for Node.js.
* **Redis Server:** A running instance of the Redis in-memory data store.
* **k6:** A modern load testing tool for performance and functional testing.

### Backend Configuration

1.  Obtain the necessary files for the backend server and worker components.
2.  Install required Node.js dependencies.
3.  Ensure the backend server is configured to correctly interpret client IP addresses when operating behind proxies or load balancers.
4.  Optionally, fine-tune the anomaly detection thresholds within the worker component to match desired sensitivity for different traffic patterns.
5.  Initiate the backend server process.

### Simulation Environment Setup

1.  Organize your load testing scripts in a designated directory within the project structure.
2.  Prepare the primary simulation script, which will be parameterized to simulate specific client behaviors.

## 6. Behavioral Simulation and Control

The system's adaptive behavior can be observed by simulating client traffic through two primary methods.

### Direct Simulation Execution

Specific client profiles can be simulated by executing the load testing tool directly from the command line. This involves passing environmental parameters to the simulation tool to dictate the client behavior to be generated. Multiple simulations can be run concurrently to observe interactions between different client types.

### Remote Simulation Triggering

For integration with external control interfaces (e.g., a Flutter application), the Node.js backend exposes a dedicated endpoint. This allows an external application to programmatically initiate specific client behavior simulations by sending a request with the desired profile and duration. The backend then orchestrates the execution of the load testing tool in the background.

## 7. Monitoring and Validation

To confirm the adaptive rate limiter's effectiveness, continuous monitoring of server activity and policy adjustments is crucial.

### Server Activity Logs

The console output of the running backend server provides detailed insights into the system's operation. This includes:

* Real-time statistics from the anomaly detection workers, showing client request counts, statistical averages, standard deviations, and Z-scores.
* Notifications when anomalous behavior is detected for specific clients, along with the recommended adaptive action.
* Confirmation messages when simulation tests are initiated via the control endpoint.

### Current Limits Endpoint

A dedicated API endpoint is available to query the current adaptive rate limits enforced by the system. By periodically accessing this endpoint, one can observe the dynamic changes in rate limits for various client IP addresses as the simulations progress, visually confirming the system's adaptive responses to different traffic patterns.