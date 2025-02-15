#!/bin/bash

# Set variables
PROJECT_ID=$(gcloud config get-value project)
VPC_NAME="rezepta-vpc"
REGION="us-central1"
SUBNET_NAME="rezepta-subnet"
SUBNET_RANGE="10.0.0.0/20"
CONNECTOR_RANGE="10.8.0.0/28"

echo "Creating VPC network and subnets..."

# Create VPC network
gcloud compute networks create $VPC_NAME \
    --project=$PROJECT_ID \
    --subnet-mode=custom \
    --mtu=1460 \
    --bgp-routing-mode=regional

# Create subnet
gcloud compute networks subnets create $SUBNET_NAME \
    --project=$PROJECT_ID \
    --network=$VPC_NAME \
    --region=$REGION \
    --range=$SUBNET_RANGE \
    --enable-private-ip-google-access \
    --enable-flow-logs

# Create Cloud NAT
gcloud compute routers create rezepta-router \
    --project=$PROJECT_ID \
    --network=$VPC_NAME \
    --region=$REGION

gcloud compute routers nats create rezepta-nat \
    --project=$PROJECT_ID \
    --router=rezepta-router \
    --region=$REGION \
    --nat-all-subnet-ip-ranges \
    --source-subnetwork-ip-ranges-to-nat=ALL_SUBNETWORKS_ALL_IP_RANGES

# Create VPC connector
gcloud compute networks vpc-access connectors create rezepta-connector \
    --project=$PROJECT_ID \
    --region=$REGION \
    --network=$VPC_NAME \
    --range=$CONNECTOR_RANGE \
    --min-instances=2 \
    --max-instances=10

# Create firewall rules
echo "Creating firewall rules..."

# Allow internal communication
gcloud compute firewall-rules create allow-internal \
    --project=$PROJECT_ID \
    --network=$VPC_NAME \
    --direction=INGRESS \
    --priority=1000 \
    --source-ranges=$SUBNET_RANGE \
    --action=ALLOW \
    --rules=all

# Allow health checks
gcloud compute firewall-rules create allow-health-checks \
    --project=$PROJECT_ID \
    --network=$VPC_NAME \
    --direction=INGRESS \
    --priority=1000 \
    --source-ranges=130.211.0.0/22,35.191.0.0/16 \
    --target-tags=http-server \
    --action=ALLOW \
    --rules=tcp:8080

# Allow Cloud Run ingress
gcloud compute firewall-rules create allow-cloud-run \
    --project=$PROJECT_ID \
    --network=$VPC_NAME \
    --direction=INGRESS \
    --priority=1000 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=cloud-run \
    --action=ALLOW \
    --rules=tcp:80,tcp:443

# Create private service connection
gcloud compute addresses create google-managed-services-$VPC_NAME \
    --project=$PROJECT_ID \
    --global \
    --purpose=VPC_PEERING \
    --prefix-length=16 \
    --network=$VPC_NAME

gcloud services vpc-peerings connect \
    --project=$PROJECT_ID \
    --service=servicenetworking.googleapis.com \
    --ranges=google-managed-services-$VPC_NAME \
    --network=$VPC_NAME

echo "VPC setup complete! Now setting up monitoring..."

# Set up VPC flow logs monitoring
gcloud logging metrics create vpc_flow_logs \
    --description="VPC Flow Logs Analysis" \
    --filter="resource.type=vpc_flow AND resource.labels.subnet_name=$SUBNET_NAME"

# Create alert policy for suspicious traffic
gcloud alpha monitoring policies create \
    --display-name="VPC Flow Logs Alert" \
    --condition-filter="metric.type=\"logging.googleapis.com/user/$PROJECT_ID/vpc_flow_logs\" AND resource.type=\"global\"" \
    --condition-threshold-value=1000 \
    --condition-threshold-duration=300s \
    --notification-channels="projects/$PROJECT_ID/notificationChannels/YOUR_CHANNEL_ID" \
    --documentation-content="Suspicious traffic detected in VPC. Please investigate."

echo "VPC setup and monitoring complete!" 