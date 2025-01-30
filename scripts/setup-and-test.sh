#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting setup and test process...${NC}\n"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js version 14 or higher.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
if (( ${NODE_VERSION%%.*} < 14 )); then
    echo -e "${RED}Node.js version must be 14 or higher. Current version: ${NODE_VERSION}${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm.${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js version: $(node -v)${NC}"
echo -e "${GREEN}npm version: $(npm -v)${NC}\n"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}Dependencies installed successfully${NC}\n"

# Check if required services are running
echo -e "${YELLOW}Checking required services...${NC}"

# Check MongoDB
echo -n "Checking MongoDB... "
if nc -z localhost 27017 2>/dev/null; then
    echo -e "${GREEN}Running${NC}"
else
    echo -e "${RED}Not running${NC}"
    echo -e "${YELLOW}Please start MongoDB before running tests${NC}"
    exit 1
fi

# Check Redis
echo -n "Checking Redis... "
if nc -z localhost 6379 2>/dev/null; then
    echo -e "${GREEN}Running${NC}"
else
    echo -e "${RED}Not running${NC}"
    echo -e "${YELLOW}Please start Redis before running tests${NC}"
    exit 1
fi

# Check Elasticsearch
echo -n "Checking Elasticsearch... "
if nc -z localhost 9200 2>/dev/null; then
    echo -e "${GREEN}Running${NC}"
else
    echo -e "${RED}Not running${NC}"
    echo -e "${YELLOW}Please start Elasticsearch before running tests${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Running tests...${NC}\n"

# Run unit tests
echo -e "${YELLOW}Running unit tests...${NC}"
npm test

if [ $? -ne 0 ]; then
    echo -e "${RED}Unit tests failed${NC}"
    exit 1
fi

echo -e "${GREEN}Unit tests passed${NC}\n"

# Run API tests
echo -e "${YELLOW}Running API tests...${NC}"
npm run test:api

if [ $? -ne 0 ]; then
    echo -e "${RED}API tests failed${NC}"
    exit 1
fi

echo -e "${GREEN}API tests passed${NC}\n"

# Run coverage tests
echo -e "${YELLOW}Running coverage tests...${NC}"
npm run test:coverage

if [ $? -ne 0 ]; then
    echo -e "${RED}Coverage tests failed${NC}"
    exit 1
fi

echo -e "${GREEN}Coverage tests passed${NC}\n"

echo -e "${GREEN}All tests completed successfully!${NC}" 