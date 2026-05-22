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

🔴 **[Live Simulation Demo](https://isalehalsubaie-hash.github.io/navpod-project)**

## Tech Stack
- ROS2 | ArduPilot | ORB-SLAM3 | YOLOv8 | MAVLink
- Jetson Orin Nano | Pixhawk Cube Orange+
- MATLAB/Simulink | WebGL Simulation
- EKF3 | State Space Control | Proportional Navigation

---

## Status
🔴 Active development — Defensathon 2026

---

## Future Plans
> The following upgrades are derived from senior engineering review notes. None of these are implemented yet — they are documented here as a roadmap for the next development phase.

---

### 1. Terrain Navigation (TNav) Module
Replace GPS-aided positioning with a dedicated **Terrain Navigation** pipeline:
- Pre-load a 3D terrain map (from satellite or ArcGIS export) before launch
- During flight, extract live features from the nadir camera and match them against the stored map
- Output a corrected position fix that resets INS drift without GPS
- Tools under evaluation: **ArcGIS** (map prep), **Intelligent mapping** (cloud/edge hybrid), **ORB-SLAM3** (already integrated)

---

### 2. AI-Aided INS with Drift Compensation
The current EKF3 loop accumulates heading drift over time. Planned upgrade:
- Integrate an **AI-aided INS** block that predicts and corrects gyro drift (~5°/h spec)
- Target: 80% position accuracy maintained across a full GPS-denied ingress (no external fix)
- TNav correction loop feeds back into INS to bound error growth — INS provides dead-reckoning between terrain fixes

---

### 3. Three-Stage Navigation Architecture
```
[INav] ──(IMU + Baro)──► [INS] ──► Position Output
                           ▲
                        [GPS] (available) / [TNav] (GPS-denied)
```
- **Stage 1 — GPS available**: Standard INS + GPS fusion (current state)
- **Stage 2 — Silence mode (CAM only)**: GPS denied, terrain feature matching via nadir camera alone
- **Stage 3 — Full silence mode (CAM + LiDAR)**: Add LiDAR depth layer for more robust feature extraction in low-texture terrain

---

### 4. LiDAR Integration (Silence Mode)
When GPS is jammed and camera-only matching degrades (dust, featureless terrain):
- Add a **LiDAR sensor** alongside the existing nadir camera
- LiDAR provides dense 3D point cloud → richer feature extraction → more reliable TNav fix
- Estimated improvement: extend reliable GPS-denied range from current camera baseline

---

### 5. Feature Extraction Pipeline for 3D Map Matching
```
Satellite Image ──► 3D Map Generation ──► Feature Extraction
                                                │
                    ArcGIS / Intelligent ───────┘
                    Mapping / SLAM

Live Camera Feed ──► Transform / State Estimation (Tran_S.E) ──► Position Fix
```
- Pre-flight: build a georeferenced 3D map from satellite imagery (ArcGIS or equivalent)
- In-flight: extract terrain features in real-time, run **Transform/State Estimation** to align live view to stored map
- Output: corrected position fed back into the navigation stack

---

### 6. Unity Hardware-in-the-Loop Simulation Pipeline
For validation before physical flight tests:
```
Ground Station (mission commands)
        │
        ▼
      PX4 (control) ◄──── GPS sim
        │
        ▼
    Unity Sim ◄──── CAD Plane Model
        │
       UDP
        │
        ▼
    AI Model ──► Position Output
```
- Unity receives flight state via **UDP bridge** (replaces current WebGL-only sim)
- PX4 SITL runs inside the loop — same firmware as hardware
- AI model receives simulated sensor data and outputs position estimates
- Target fidelity: **85% sim-to-real accuracy** validated in this pipeline before hardware flights
- Dead Reckoning Integration (DRI) block added to bridge gap between terrain fixes
