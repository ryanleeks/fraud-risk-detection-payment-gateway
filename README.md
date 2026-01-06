# fraud-risk-detection-payment-gateway

This is the repository of Ryan's final year project: "Developing a Fraud Detection and Debt Risk Mitigation System Using Containerized Microservices on a Cloud-Based Digital Payment Environment."

## Overview

## Key Features

## Architecture

### Tech Stack
**PERN Stack**
- PostgreSQL
- Express.js
- Next.js (React)
- Node.js

**Payment Gateway and Features**
- Stripe

### Infrastructure & Deployment
- Amazon Web Services (AWS)
- Docker Containter and Microservices

## Setup and Configuration

## Limitations & Future Work

### Current Limitations

This section documents the known limitations of the system, categorized by area. These limitations are acknowledged as part of the academic project scope and provide valuable insights for future improvements.

#### 1. Infrastructure & Performance

**EC2 Instance Constraints**
- **Low Specification Hardware**: Due to budget constraints, the system runs on lower-tier AWS EC2 instances (e.g., t2.micro or t2.small)
- **Impact**: Limited CPU and memory resources can affect performance under high concurrent load
- **Mitigation**: The system is designed for proof-of-concept and academic demonstration rather than production-scale traffic

**Database Architecture**
- **SQLite in Production**: Currently uses SQLite for simplicity and cost-effectiveness
- **Limitations**:
  - Not suitable for high concurrent write operations
  - Single-file database limits horizontal scaling
  - No built-in replication or failover mechanisms
- **Original Design**: README mentions PostgreSQL (PERN stack), but implementation uses SQLite

**Scalability Constraints**
- **Single Instance Deployment**: No load balancing or horizontal scaling implemented
- **No High Availability**: Single point of failure if EC2 instance goes down
- **Limited Caching**: No Redis or Memcached layer for frequently accessed data
- **Synchronous Processing**: All fraud detection runs synchronously, blocking the request thread

#### 2. AI & Machine Learning Limitations

**Google Gemini AI Constraints**
- **API Rate Limits**: Free tier limited to 15 requests/minute and 1,500 requests/day
- **Response Inconsistency**: LLM-based fraud detection may produce inconsistent results for identical transactions due to the probabilistic nature of AI models
- **Latency**: AI analysis adds ~2-3 seconds to transaction processing time
- **External Dependency**: Requires internet connectivity and Google API availability
- **No Model Training**: Cannot fine-tune the model on project-specific fraud patterns
- **Prompt Engineering Dependency**: Detection quality heavily relies on prompt design

**Hybrid Detection Fallback**
- **Graceful Degradation**: System falls back to rule-based detection when AI fails
- **Trade-off**: Rules alone may miss sophisticated fraud patterns that AI could detect

#### 3. Security Considerations

**Authentication & Authorization**
- **JWT Secret Management**: Secrets stored in environment files rather than secure vault (e.g., AWS Secrets Manager)
- **Session Management**: No token refresh mechanism or session invalidation tracking
- **Password Policy**: No enforced password complexity requirements in the current implementation

**API Security**
- **Rate Limiting**: Limited API rate limiting implementation (mainly for AI endpoints)
- **DDoS Protection**: No CloudFlare or AWS Shield integration
- **Input Validation**: Basic validation present but could be more comprehensive

**Data Security**
- **Encryption at Rest**: SQLite database not encrypted by default
- **Sensitive Data**: Transaction passcodes and 2FA codes stored with basic encryption
- **Audit Logging**: Limited audit trail for security events

#### 4. Testing & Quality Assurance

**Test Coverage**
- **No Automated Tests**: No unit tests, integration tests, or end-to-end tests found in repository
- **Manual Testing Only**: Reliance on manual testing increases risk of regressions
- **No CI/CD Pipeline**: No automated testing or deployment pipeline

**Code Quality**
- **Limited Error Handling**: Some edge cases may not be properly handled
- **Tech Debt**: TODOs and FIXMEs present in codebase (found via code search)

#### 5. Monitoring & Observability

**Limited Monitoring**
- **Basic Logging**: Console-based logging only, no centralized log management
- **No APM Tools**: No Application Performance Monitoring (e.g., New Relic, DataDog)
- **No Alerting**: No automated alerts for system failures or fraud spikes
- **No Distributed Tracing**: Difficult to trace requests across microservices

**Metrics Collection**
- **Basic Metrics**: Academic metrics export available but limited production monitoring
- **No Real-time Dashboards**: No Grafana or similar visualization for system health

#### 6. Payment Processing

**Stripe Integration**
- **Test Mode Only**: Designed for development/testing, not production payments
- **Limited Payment Methods**: May not support all regional payment methods
- **Webhook Reliability**: No retry mechanism if webhook processing fails

#### 7. Compliance & Regulations

**Data Privacy**
- **GDPR Compliance**: No explicit GDPR compliance features (data export, right to deletion)
- **Data Retention**: No automatic data retention policies
- **Privacy Policy**: No formal privacy policy implementation

**Financial Regulations**
- **PCI DSS**: Not PCI DSS compliant (Stripe handles card data, but overall system not certified)
- **AML/KYC**: Basic fraud detection but no comprehensive AML (Anti-Money Laundering) compliance
- **Audit Requirements**: No formal audit logging for financial transactions

#### 8. Documentation & Deployment

**Documentation Gaps**
- **API Documentation**: No OpenAPI/Swagger documentation
- **Deployment Guide**: Limited documentation for production deployment
- **Runbooks**: No operational runbooks for incident response
- **Architecture Diagrams**: Limited visual documentation of system architecture

**Development Experience**
- **Environment Setup**: Manual setup process, no automated development environment
- **No Development Tools**: No debugging tools, profilers, or performance analysis tools integrated

### Recommendations for Future Improvements

#### Short-term Improvements (0-3 months)

1. **Testing Infrastructure**
   - Implement unit tests using Jest or Mocha for backend services
   - Add integration tests for API endpoints
   - Set up GitHub Actions for automated testing
   - Target: Achieve at least 60% code coverage

2. **Enhanced Monitoring**
   - Integrate structured logging with Winston or Bunyan
   - Add basic health check endpoints with detailed status
   - Implement error tracking with Sentry (free tier)
   - Create simple dashboards for fraud metrics

3. **Security Hardening**
   - Move secrets to AWS Secrets Manager or HashiCorp Vault
   - Implement comprehensive input validation and sanitization
   - Add rate limiting to all public API endpoints using express-rate-limit
   - Enable HTTPS/TLS for all communications
   - Implement password complexity requirements

4. **Database Improvements**
   - Migrate from SQLite to PostgreSQL (as originally designed)
   - Set up automated database backups to S3
   - Implement database migration scripts using tools like Knex or Sequelize
   - Add database connection pooling

5. **AI Optimization**
   - Implement caching for similar fraud analysis requests
   - Add circuit breaker pattern for AI service calls
   - Create fallback strategies when rate limits are exceeded
   - Optimize prompts to reduce token usage and improve consistency

#### Medium-term Improvements (3-6 months)

1. **Scalability Enhancements**
   - Implement Redis caching layer for frequently accessed data
   - Add message queue (RabbitMQ or AWS SQS) for async fraud detection
   - Set up load balancing with AWS ELB
   - Containerize services with proper resource limits
   - Implement horizontal pod autoscaling if moving to Kubernetes

2. **AI/ML Evolution**
   - Collect fraud detection data for model training
   - Explore fine-tuning Gemini or using custom ML models
   - Implement A/B testing for AI vs. rule-based detection
   - Add feedback loop for false positives/negatives
   - Consider multiple AI providers for redundancy (OpenAI GPT-4, Anthropic Claude)

3. **Advanced Security**
   - Implement OAuth 2.0 / OpenID Connect
   - Add biometric authentication options
   - Implement anomaly detection for account takeover
   - Set up Web Application Firewall (WAF)
   - Conduct security audit and penetration testing

4. **Compliance & Governance**
   - Implement GDPR compliance features (data export, deletion)
   - Add comprehensive audit logging
   - Create data retention and archival policies
   - Document compliance procedures for financial regulations

5. **Observability Platform**
   - Set up ELK stack (Elasticsearch, Logstash, Kibana) or equivalent
   - Implement distributed tracing with Jaeger or AWS X-Ray
   - Create custom Grafana dashboards for business metrics
   - Set up PagerDuty or similar for incident management

#### Long-term Improvements (6-12 months)

1. **Production-Grade Infrastructure**
   - Migrate to higher-tier EC2 instances or containerized infrastructure (ECS/EKS)
   - Implement multi-region deployment for disaster recovery
   - Set up proper CI/CD pipeline with blue-green deployments
   - Implement infrastructure as code (Terraform or CloudFormation)
   - Add CDN (CloudFront) for static assets

2. **Advanced Fraud Detection**
   - Train custom machine learning models on collected data
   - Implement graph analysis for fraud ring detection
   - Add device fingerprinting and behavioral biometrics
   - Integrate third-party fraud databases and threat intelligence
   - Implement real-time stream processing for fraud detection

3. **Microservices Maturity**
   - Implement service mesh (Istio or Linkerd)
   - Add API gateway with advanced routing and throttling
   - Implement event-driven architecture with Kafka
   - Add service-to-service authentication
   - Implement proper distributed transaction handling

4. **Business Intelligence**
   - Build comprehensive analytics platform
   - Implement machine learning for transaction pattern analysis
   - Create executive dashboards with business KPIs
   - Add predictive analytics for fraud trends
   - Implement customer segmentation and risk profiling

5. **Developer Experience**
   - Create comprehensive API documentation with Swagger/OpenAPI
   - Implement GraphQL API for flexible data querying
   - Set up local development environment with Docker Compose
   - Create developer portal with integration guides
   - Implement automated database seeding for development

### Academic Contribution

This project demonstrates a working proof-of-concept for hybrid (rule-based + AI) fraud detection in a payment gateway context. The documented limitations provide valuable learning opportunities and represent realistic constraints faced in real-world software development, particularly in:

- **Resource-Constrained Environments**: Balancing functionality with limited infrastructure budget
- **AI Integration Challenges**: Navigating the trade-offs between AI accuracy and consistency
- **Security vs. Usability**: Implementing reasonable security measures in an academic timeline
- **Scalability Planning**: Understanding the architectural decisions needed for production systems

### Disclaimer

This system is designed as an **academic research project** to demonstrate fraud detection concepts and is **not intended for production financial transactions** without significant enhancements in security, compliance, scalability, and testing.

## License
This project repository is currently unlicensed.

## Acknowledgments


No part of this repository — including all source code, designs, and written content — may be copied, reproduced, or distributed without explicit permission.

For licensing or attribution inquiries, please contact: @gmail.com.

Copyright © 2025 Ryan Lee Khang Sern. All rights reserved.
