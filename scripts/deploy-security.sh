#!/bin/bash

# Set variables
PROJECT_ID=$(gcloud config get-value project)
POLICY_NAME="rezepta-security-policy"
BACKEND_SERVICE="rezepta-backend"
REGION="us-central1"

echo "Deploying Cloud Armor security policy..."

# Create the security policy
gcloud compute security-policies create $POLICY_NAME \
  --project=$PROJECT_ID \
  --description="Security policy for Rezepta backend API"

# Import rules from YAML file
gcloud compute security-policies import $POLICY_NAME \
  --source=cloud-armor-policy.yaml \
  --project=$PROJECT_ID

# Enable Cloud Armor on the backend service
gcloud compute backend-services update $BACKEND_SERVICE \
  --security-policy=$POLICY_NAME \
  --global \
  --project=$PROJECT_ID

# Create required firewall rules
gcloud compute firewall-rules create allow-health-checks \
  --network=default \
  --action=allow \
  --direction=ingress \
  --source-ranges=130.211.0.0/22,35.191.0.0/16 \
  --target-tags=http-server \
  --rules=tcp:8080

# Set up logging
gcloud logging metrics create security_policy_violations \
  --description="Count of Cloud Armor security policy violations" \
  --filter="resource.type=http_load_balancer AND jsonPayload.enforcedSecurityPolicy.name=$POLICY_NAME AND jsonPayload.enforcedSecurityPolicy.outcome=DENY"

# Create alert policy for security violations
gcloud alpha monitoring policies create \
  --display-name="Cloud Armor Security Policy Violations" \
  --condition-filter="metric.type=\"logging.googleapis.com/user/$PROJECT_ID/security_policy_violations\" AND resource.type=\"global\"" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s \
  --notification-channels="projects/$PROJECT_ID/notificationChannels/YOUR_CHANNEL_ID" \
  --documentation-content="Security policy violations detected. Please investigate immediately."

echo "Cloud Armor security policy deployment complete!"

# Verify deployment
echo "Verifying security policy..."
gcloud compute security-policies describe $POLICY_NAME --project=$PROJECT_ID

# Test security policy
echo "Testing security policy..."
curl -v -H "X-Forwarded-For: MALICIOUS_IP_RANGE_1" https://api.rezepta.com/health
curl -v -H "User-Agent: sqlmap" https://api.rezepta.com/health
curl -v --data "' OR '1'='1" https://api.rezepta.com/health

echo "Setup complete! Please verify the security policy is working as expected." 