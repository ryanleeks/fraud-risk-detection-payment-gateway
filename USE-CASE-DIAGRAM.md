# Use Case Diagram - FraudWallet Payment Gateway

## Overview

This use case diagram illustrates all the functional requirements and interactions within the FraudWallet Fraud Detection Payment Gateway System. The diagram shows the relationships between different actors and their associated use cases.

## Actors

### 1. **User (Regular User)** 👤
Regular customers who use the payment gateway for transactions, split payments, and monitoring their fraud alerts.

### 2. **Administrator** 👨‍💼
Super users with full system access, responsible for:
- Fraud verification and investigation
- Managing appeals
- User management
- Academic research and metrics analysis
- System monitoring

### 3. **Fraud Detection AI** 🤖
Automated AI-powered fraud detection system that:
- Analyzes all transactions in real-time
- Calculates risk scores
- Flags suspicious activities
- Holds or auto-approves transactions
- Logs fraud data for analysis

### 4. **Stripe Payment Gateway** 💳
External payment processing system that handles:
- Payment processing
- Webhook notifications
- Fund transfers

### 5. **Email/SMS System** 📧
Communication system for:
- Sending 2FA codes
- Email notifications
- Alerts

## Use Case Categories

### Authentication & Account Management
- User registration and login
- Two-factor authentication (2FA)
- Profile management
- Passcode security
- Account termination

### Wallet & Payments
- Wallet balance management
- Adding funds via Stripe
- Sending money to other users
- Transaction history
- Recipient lookup (by phone, email, or Account ID)
- Viewing held transactions

### SplitPay Features
- Creating split payment requests
- Responding to split requests (accept/reject)
- Paying individual shares
- Canceling split payments
- Viewing all split payment activity

### Fraud Monitoring (User View)
- Personal fraud dashboard
- Viewing fraud alerts and flags
- Fraud statistics and trends
- Submitting appeals for flagged transactions
- Viewing appeal status
- System health monitoring

### Fraud Detection Engine (AI)
- Real-time transaction analysis
- Risk score calculation
- Suspicious transaction flagging
- Transaction holding
- Auto-approval of low-risk transactions
- Comprehensive fraud data logging

### Admin - Fraud Management
- Manual fraud verification
- Reviewing and resolving appeals
- Money management (release, return, confiscate)
- Auto-approval control
- Viewing unverified logs

### Admin - Analytics & Research
- Academic metrics (Precision, Recall, F1-Score)
- Confusion matrix analysis
- Dataset export (CSV format)
- Metrics history tracking
- Error analysis
- Threshold analysis
- AI performance metrics
- Disagreement case analysis
- System performance export

### Admin - User Management
- Viewing all users
- User detail inspection
- High-risk user identification
- Top flagged user tracking
- Individual user fraud detail analysis

## Key Relationships

### Dependencies
- **Login** extends with **Verify 2FA Code** (when 2FA is enabled)
- **Add Funds** includes **Process Stripe Payment**
- **Send Money** includes **Analyze Transaction for Fraud**
- **Analyze Transaction** includes **Calculate Risk Score**
- **Calculate Risk Score** includes **Flag Suspicious Transaction**
- **Flag Suspicious Transaction** includes **Hold Transaction**
- **Toggle 2FA** includes **Send 2FA Code**
- **Submit Appeal** includes **Send Email Notifications**
- **Verify Fraud Transactions** includes **Log Fraud Data**

## How to View This Diagram

### Option 1: Online PlantUML Viewer
1. Go to [PlantUML Online Editor](https://www.plantuml.com/plantuml/uml/)
2. Copy the contents of `use-case-diagram.puml`
3. Paste into the editor
4. The diagram will render automatically

### Option 2: VS Code Extension
1. Install the "PlantUML" extension in VS Code
2. Open `use-case-diagram.puml`
3. Press `Alt + D` to preview the diagram

### Option 3: Local PlantUML Installation
```bash
# Install PlantUML (requires Java)
# On macOS
brew install plantuml

# On Ubuntu/Debian
sudo apt-get install plantuml

# Generate PNG image
plantuml use-case-diagram.puml

# Generate SVG image
plantuml -tsvg use-case-diagram.puml
```

### Option 4: GitHub Integration
GitHub automatically renders PlantUML diagrams. Simply view the `.puml` file on GitHub.

## System Architecture Context

This use case diagram is part of Ryan's final year project:

**"Developing a Fraud Detection and Debt Risk Mitigation System Using Containerized Microservices on a Cloud-Based Digital Payment Environment"**

### Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: SQLite (development), PostgreSQL (production)
- **Payment**: Stripe API
- **Infrastructure**: Docker, AWS
- **AI**: Custom fraud detection algorithms

## Use Case Statistics

- **Total Use Cases**: 61
- **User Use Cases**: 28
- **Admin Use Cases**: 25
- **AI System Use Cases**: 6
- **External System Use Cases**: 4

## Notes

- All transactions are automatically analyzed by the Fraud Detection AI
- Administrators can perform all user actions for testing and support
- The system uses a multi-layered fraud detection approach combining AI and manual verification
- Appeals process ensures users can contest false positives
- Academic metrics support research and system improvement

## Copyright

Copyright © 2025 Ryan Lee Khang Sern. All rights reserved.

For licensing or attribution inquiries, please contact: @gmail.com
