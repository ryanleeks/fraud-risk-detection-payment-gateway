#!/bin/bash

# Stop all FraudWallet microservices

echo "🛑 Stopping FraudWallet Microservices..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

stop_service() {
    local service_name=$1
    local pid_file="/tmp/fraudwallet-${service_name}.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo -e "${YELLOW}Stopping ${service_name} (PID: ${pid})...${NC}"
            kill $pid
            rm "$pid_file"
            echo -e "${GREEN}✓ ${service_name} stopped${NC}"
        else
            echo -e "${YELLOW}${service_name} not running${NC}"
            rm "$pid_file"
        fi
    else
        echo -e "${YELLOW}${service_name} PID file not found${NC}"
    fi
}

stop_service "Auth Service"
stop_service "User Service"
stop_service "Wallet Service"
stop_service "SplitPay Service"
stop_service "Fraud Detection Service"
stop_service "API Gateway"

# Clean up log files
echo ""
echo -e "${YELLOW}Cleaning up log files...${NC}"
rm -f /tmp/fraudwallet-*.log
echo -e "${GREEN}✓ Logs cleaned${NC}"

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"
