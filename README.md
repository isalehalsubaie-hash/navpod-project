# NavPod — GPS-Denied Autonomous BWB Strike UAV
**Platform:** Blended Wing Body (BWB) Fixed-Wing UAV | **Event:** Defensathon 2026 — UAV Track

> "Not a concept. Not a slide deck. A fully working technical simulation grounded in 
> real hardware, aerodynamics, and AI architecture."

---

## The Problem
Every precision-strike platform in service today depends on GPS. Modern EW systems 
(like the Krasukha-4) can deny GPS across 200km in under 90 seconds. When that 
happens, the kill-chain collapses. NavPod's answer isn't GPS-resistant — it's GPS-independent.

---

## Architecture

### Outer Loop — AI Mission Processing (Jetson Orin Nano, 40 TOPS)
- ORB-SLAM3: 6-DoF terrain mapping, no GPS
- YOLOv8-n: 60fps INT8 target classification
- Sends exactly 4 numbers to inner loop: Δheading, Δpitch, Δroll, Vref

### Inner Loop — Flight Stabilization (Pixhawk Cube Orange+ / ArduPilot)
- 400Hz EKF3, triple IMU redundancy
- BWB elevon mixer: δL = (Pitch+Roll)/2, δR = (Pitch−Roll)/2
- Failure containment: If AI dies, ArduPilot holds wings-level and RTBs

### Bridge
- MAVLink via UART, 921,600 baud
- Cryptographically signable

---

## Simulations Built (7 Variants)

| Variant | Description |
|---------|-------------|
| BWB Kinetic Strike | Main sim — full EW jamming dome, autonomous hunt, terminal dive |
| Canyon Strike | Terrain-following nap-of-earth variant to defeat radar detection |
| SLAM Mapping | Quadcopter swarm for building 3D point-cloud maps of contested terrain |
| CONOPS & Architecture | Full operational doctrine and animated mission-synced block diagram |

---

## AI Detection Logic
Detection is geometry, not timers. NavPod confirms a lock only when the target is 
physically inside the camera frustum for 1,200ms of continuous sighting. Search uses 
an ICAO-standard creeping-line lawnmower pattern with guaranteed sensor swath overlap 
to protect the SLAM feature baseline.

---

## The Breakthrough
Uploaded an actual satellite image of a real military compound. The simulation rebuilt 
the entire 3D target from the photo — curved assembly hall, warehouses, command 
building, and helipad. NavPod hunts that exact compound. It doesn't work on a 
fictional map. It works on the real world.

---
## Hardware Architecture

![NavPod Hardware Architecture](hardware-architecture.jpg)

## Tech Stack
- ROS2 | ArduPilot | ORB-SLAM3 | YOLOv8 | MAVLink
- Jetson Orin Nano | Pixhawk Cube Orange+
- MATLAB/Simulink | WebGL Simulation
- EKF3 | State Space Control | Proportional Navigation

---

## Status
🔴 Active development — Defensathon 2026
