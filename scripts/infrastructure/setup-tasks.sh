#!/bin/bash

# Set variables
PROJECT_ID=$(gcloud config get-value project)
LOCATION="us-central1"
SERVICE_ACCOUNT_NAME="cloud-tasks-invoker"

echo "Setting up Cloud Tasks..."

# Create service account for Cloud Tasks
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --project=$PROJECT_ID \
    --display-name="Cloud Tasks Invoker"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudtasks.enqueuer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.invoker"

# Create queues
echo "Creating task queues..."

# Email queue
gcloud tasks queues create email-queue \
    --project=$PROJECT_ID \
    --location=$LOCATION \
    --max-concurrent-dispatches=100 \
    --max-dispatches-per-second=500 \
    --max-attempts=5 \
    --min-backoff=10s \
    --max-backoff=300s \
    --max-doublings=4

# Notification queue
gcloud tasks queues create notification-queue \
    --project=$PROJECT_ID \
    --location=$LOCATION \
    --max-concurrent-dispatches=200 \
    --max-dispatches-per-second=1000 \
    --max-attempts=3 \
    --min-backoff=5s \
    --max-backoff=60s \
    --max-doublings=3

# Analytics queue
gcloud tasks queues create analytics-queue \
    --project=$PROJECT_ID \
    --location=$LOCATION \
    --max-concurrent-dispatches=50 \
    --max-dispatches-per-second=100 \
    --max-attempts=2 \
    --min-backoff=30s \
    --max-backoff=120s \
    --max-doublings=2

# Set up monitoring
echo "Setting up monitoring..."

# Create monitoring metrics for each queue
for QUEUE in email-queue notification-queue analytics-queue; do
    gcloud logging metrics create ${QUEUE}_failures \
        --description="Count of failed tasks in ${QUEUE}" \
        --filter="resource.type=cloud_tasks_queue AND resource.labels.queue_id=${QUEUE} AND severity>=ERROR"

    # Create alert policy for queue failures
    gcloud alpha monitoring policies create \
        --display-name="${QUEUE} Failures Alert" \
        --condition-filter="metric.type=\"logging.googleapis.com/user/$PROJECT_ID/${QUEUE}_failures\" AND resource.type=\"cloud_tasks_queue\"" \
        --condition-threshold-value=10 \
        --condition-threshold-duration=300s \
        --condition-comparison="COMPARISON_GT" \
        --notification-channels="projects/$PROJECT_ID/notificationChannels/YOUR_CHANNEL_ID" \
        --documentation-content="High failure rate detected in ${QUEUE}. Please investigate."
done

# Create dashboard for queue metrics
echo "Creating Cloud Tasks dashboard..."
cat << EOF > tasks-dashboard.json
{
  "displayName": "Cloud Tasks Dashboard",
  "gridLayout": {
    "columns": "2",
    "widgets": [
      {
        "title": "Queue Depths",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"cloudtasks.googleapis.com/queue/depth\" AND resource.type=\"cloud_tasks_queue\""
                }
              }
            }
          ]
        }
      },
      {
        "title": "Task Latency",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"cloudtasks.googleapis.com/queue/task/latency\" AND resource.type=\"cloud_tasks_queue\""
                }
              }
            }
          ]
        }
      }
    ]
  }
}
EOF

gcloud monitoring dashboards create --config-from-file=tasks-dashboard.json

echo "Cloud Tasks setup complete!" 