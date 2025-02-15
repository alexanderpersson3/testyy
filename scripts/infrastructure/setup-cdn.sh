#!/bin/bash

# Set variables
PROJECT_ID=$(gcloud config get-value project)
BACKEND_SERVICE="rezepta-backend"
REGION="us-central1"
SSL_CERT_NAME="rezepta-ssl-cert"

echo "Setting up Cloud CDN..."

# Create SSL certificate
gcloud compute ssl-certificates create $SSL_CERT_NAME \
    --project=$PROJECT_ID \
    --domains=api.rezepta.com \
    --global

# Enable Cloud CDN on the backend service
gcloud compute backend-services update $BACKEND_SERVICE \
    --project=$PROJECT_ID \
    --enable-cdn \
    --global \
    --cache-mode=USE_ORIGIN_HEADERS \
    --connection-draining-timeout=300s

# Configure CDN cache policies
gcloud compute backend-services update $BACKEND_SERVICE \
    --project=$PROJECT_ID \
    --global \
    --custom-response-header="Cache-Control: public, max-age=3600" \
    --custom-response-header="Vary: Accept-Encoding, Origin"

# Create CDN cache key policy
gcloud compute backend-services update $BACKEND_SERVICE \
    --project=$PROJECT_ID \
    --global \
    --cache-key-policy-include-protocol \
    --cache-key-policy-include-host \
    --cache-key-policy-include-query-string \
    --cache-key-policy-query-string-whitelist="v,page,limit"

# Set up monitoring
echo "Setting up CDN monitoring..."

# Create monitoring metrics
gcloud logging metrics create cdn_cache_hit_ratio \
    --description="Cloud CDN Cache Hit Ratio" \
    --filter="resource.type=http_load_balancer AND resource.labels.backend_service_name=$BACKEND_SERVICE AND jsonPayload.cacheStatus=HIT"

# Create alert for low cache hit ratio
gcloud alpha monitoring policies create \
    --display-name="CDN Cache Hit Ratio Alert" \
    --condition-filter="metric.type=\"logging.googleapis.com/user/$PROJECT_ID/cdn_cache_hit_ratio\" AND resource.type=\"global\"" \
    --condition-threshold-value=0.8 \
    --condition-threshold-duration=300s \
    --condition-comparison="COMPARISON_LT" \
    --notification-channels="projects/$PROJECT_ID/notificationChannels/YOUR_CHANNEL_ID" \
    --documentation-content="Cache hit ratio is below threshold. Please investigate cache configuration."

# Create alert for cache fill bytes
gcloud alpha monitoring policies create \
    --display-name="CDN Cache Fill Bytes Alert" \
    --condition-filter="metric.type=loadbalancing.googleapis.com/https/backend_latencies AND resource.type=https_lb_rule" \
    --condition-threshold-value=5000000 \
    --condition-threshold-duration=300s \
    --condition-comparison="COMPARISON_GT" \
    --notification-channels="projects/$PROJECT_ID/notificationChannels/YOUR_CHANNEL_ID" \
    --documentation-content="High cache fill bytes detected. Please investigate backend performance."

echo "Cloud CDN setup and monitoring complete!"

# Add cache control headers to common response types
cat << EOF > cdn-headers.json
{
  "responseHeaders": [
    {
      "headerName": "Cache-Control",
      "headerValue": "public, max-age=3600",
      "urlMatch": "*.json"
    },
    {
      "headerName": "Cache-Control",
      "headerValue": "public, max-age=86400",
      "urlMatch": "*.jpg,*.png,*.gif,*.webp"
    },
    {
      "headerName": "Cache-Control",
      "headerValue": "no-store",
      "urlMatch": "/api/auth/*,/api/user/*"
    }
  ]
}
EOF

# Apply cache control headers
gcloud compute url-maps import rezepta-url-map \
    --project=$PROJECT_ID \
    --global \
    --source=cdn-headers.json

echo "Cache control headers configured!" 