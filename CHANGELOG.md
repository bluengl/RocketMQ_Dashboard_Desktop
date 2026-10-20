# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **ACL management (phase 7)**
  - ACL 2.0 users: list, create, update and delete via `AUTH_CREATE_USER` (3001), `AUTH_UPDATE_USER` (3002), `AUTH_DELETE_USER` (3003) and `AUTH_LIST_USER` (3005)
  - ACL 2.0 rules: list, create, update and delete via `AUTH_CREATE_ACL` (3006), `AUTH_UPDATE_ACL` (3007), `AUTH_DELETE_ACL` (3008) and `AUTH_LIST_ACL` (3010)
  - Users and rules are read from and applied to every master broker, with per-broker errors surfaced in the UI
  - Optional ACL credentials on the connection bar; requests are signed with `AccessKey` + `Signature` (HMAC-SHA1 over sorted ext fields and body)
  - New ACL page with Users and ACL Rules tabs (actions: Pub/Sub/Any/Create/Update/Delete/Get/List/All; decisions: Allow/Deny)
- **Producer query (phase 5)**
  - Producer groups via `GET_ALL_PRODUCER_INFO` (328) aggregated across master brokers
  - Online producer clients via `GET_PRODUCER_CONNECTION_LIST` (204), optionally scoped to brokers hosting a topic
  - New Producers page with group search and connection table
- **Cluster + Dashboard (phase 4)**
  - Broker runtime info via `GET_BROKER_RUNTIME_INFO` (28), parsed from the `table` payload
  - Dashboard KPIs (brokers / topics / consumer groups / produce TPS / consume TPS) with a 5s polling loop
  - Produce/Consume TPS trend chart (Recharts, 60-sample window) with chart/table view toggle
  - Cluster topology (cluster → broker → master/slave addresses) and a searchable runtime-info modal
  - Broker stats commands for `VIEW_BROKER_STATS_DATA` (107) and `GET_BROKER_CONSUME_STATS` (109); the 5.3.2 broker reports them as unsupported
- **Message trace (phase 6)**
  - Trace lookup by message ID and by business key
  - Queries `RMQ_SYS_TRACE_TOPIC` via `QUERY_MESSAGE` (12), with an optional custom trace topic
  - Timeline of produce / consume / endTransaction / recall nodes plus consumer delivery status
  - "View Trace" entry point from the message detail panel
- **Consumer management (phase 3)**
  - Consumer group enumeration via `GET_ALL_SUBSCRIPTIONGROUP_CONFIG` (201)
  - Online connections list with client id, address, language and version
  - Per-queue consume progress (broker offset / consumer offset / lag)
  - Consume TPS card computed from consumer offset deltas (5s sampling)
  - Offset reset to latest, earliest or a custom value, for one queue or all queues

### Fixed
- Tailwind CSS is now installed and wired in (v4 + `@tailwindcss/vite`), so utility classes used across existing pages actually apply
- Errors are stringified before rendering, so an `Error` object can no longer crash a page
- Consumer group listing used request code 200 (`UPDATE_AND_CREATE_SUBSCRIPTIONGROUP`); corrected to 201
- Connection list used request code 204 (`GET_CONSUMER_RUNNING_INFO`); corrected to 203
- `QUERY_CONSUMER_OFFSET` now sends `queueId` and reads the offset from the response header

### Planned
- Producer query

## [0.3.0-alpha] - 2026-10-20

### Added
- **Connection Management**
  - Connect/disconnect to NameServer
  - Connection status display
  - Connection test functionality
  - Timeout protection (5s connect, 10s read)

- **Cluster Management**
  - Broker list view
  - Cluster topology visualization
  - Broker details (name, address, cluster, master-slave relationship)
  - Online status monitoring

- **Topic Management**
  - Topic list query
  - Topic details display
  - Search and filter functionality

- **Consumer Management**
  - Consumer group list
  - Consumer progress query
  - Online instance monitoring
  - Message lag statistics and alerts

- **UI/UX**
  - Modern dark theme design
  - Responsive layout
  - Sidebar navigation
  - Real-time status indicators
  - Statistics cards

- **RocketMQ Protocol**
  - Implemented native RocketMQ Remoting protocol
  - TCP connection with JSON serialization
  - Supported request codes:
    - GET_BROKER_CLUSTER_INFO (103)
    - GET_ALL_TOPIC_LIST_FROM_NAMESERVER (17)
    - GET_ALL_CONSUMER_GROUP (200)
    - QUERY_CONSUMER_OFFSET (14)
    - GET_CONSUMER_CONNECTION_LIST (204)

### Technical
- Tauri 2.8 desktop framework
- React 18 + TypeScript frontend
- Rust 1.82 backend
- Vite 5 build tool
- lucide-react icon library

### Documentation
- README.md (English)
- README.zh-CN.md (Chinese)
- PROGRESS.md (Development progress)
- SUMMARY.md (Implementation summary)
- TEST_CHECKLIST.md (Test checklist)
- LICENSE (MIT)

## [0.2.0-alpha] - 2026-10-19

### Added
- Initial project setup
- Tauri + React integration
- Basic RocketMQ client implementation
- Connection management UI

## [0.1.0-alpha] - 2026-10-18

### Added
- Project initialization
- Technology stack selection
- Architecture design

---

## Version Naming Convention

- **Major version**: Breaking changes or complete feature overhaul
- **Minor version**: New features, backward compatible
- **Patch version**: Bug fixes, minor improvements
- **Alpha/Beta/RC**: Pre-release versions for testing

Example:
- `0.3.0-alpha`: Alpha version with connection and cluster management
- `0.4.0-beta`: Beta version with message query
- `1.0.0`: First stable release

---

[Unreleased]: https://github.com/your-username/rocketmq-dashboard-desktop/compare/v0.3.0-alpha...HEAD
[0.3.0-alpha]: https://github.com/your-username/rocketmq-dashboard-desktop/releases/tag/v0.3.0-alpha
[0.2.0-alpha]: https://github.com/your-username/rocketmq-dashboard-desktop/releases/tag/v0.2.0-alpha
[0.1.0-alpha]: https://github.com/your-username/rocketmq-dashboard-desktop/releases/tag/v0.1.0-alpha
